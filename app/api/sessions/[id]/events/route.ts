import { registerClient, broadcastToSession } from "@/lib/sse";
import { db } from "@/lib/db";
import { sessions, trends } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  ensureTickerStarted,
  setFloatValue,
  clearFloatValue,
  clearAutoFired,
} from "@/lib/ticker";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureTickerStarted();
  const { id: sessionId } = await params;

  // Verify session exists
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      // Register this client
      const unsubscribe = registerClient(sessionId, controller);

      // Send initial state
      const encoder = new TextEncoder();
      const message = `data: ${JSON.stringify({ type: "connected" })}\n\n`;
      controller.enqueue(encoder.encode(message));

      // Handle connection close
      request.signal.addEventListener("abort", () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  ensureTickerStarted();
  const { id: sessionId } = await params;
  const body = await request.json();
  const { action, data } = body;

  // Verify session exists
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  let result = { success: true };

  if (action === "updateTrendValue") {
    const { trendId, value } = data;
    await db
      .update(trends)
      .set({ value })
      .where(eq(trends.id, trendId));
    setFloatValue(trendId, value);

    // Broadcast update
    broadcastToSession(sessionId, "trendUpdated", {
      trendId,
      value,
    });
  } else if (action === "updateTrendRate") {
    const { trendId, incrementRate } = data;
    await db
      .update(trends)
      .set({ incrementRate })
      .where(eq(trends.id, trendId));

    // Rebase the ticker's running value to the current stored value so the
    // new rate doesn't cause a jump from stale float state.
    const current = await db.query.trends.findFirst({
      where: eq(trends.id, trendId),
    });
    if (current) setFloatValue(trendId, current.value ?? 0);

    broadcastToSession(sessionId, "trendRateUpdated", {
      trendId,
      incrementRate,
    });
  } else if (action === "updateTrendConfig") {
    const { trendId, name, incrementRate, rampStages, color } = data;
    await db
      .update(trends)
      .set({
        name,
        incrementRate: incrementRate ?? 0,
        rampStages: rampStages ?? null,
        color: color ?? null,
      })
      .where(eq(trends.id, trendId));

    // Rebase the ticker's running value so an edited rate/curve doesn't
    // cause a jump from stale float state.
    const current = await db.query.trends.findFirst({
      where: eq(trends.id, trendId),
    });
    if (current) setFloatValue(trendId, current.value ?? 0);

    broadcastToSession(sessionId, "trendConfigUpdated", { trend: current });
  } else if (action === "pauseTrend") {
    const { trendId } = data;
    await db.update(trends).set({ isPaused: true }).where(eq(trends.id, trendId));

    broadcastToSession(sessionId, "trendPaused", { trendId });
  } else if (action === "playTrend") {
    const { trendId } = data;
    await db.update(trends).set({ isPaused: false }).where(eq(trends.id, trendId));

    // Rebase so resuming doesn't jump using a stale accumulated float.
    const current = await db.query.trends.findFirst({
      where: eq(trends.id, trendId),
    });
    if (current) setFloatValue(trendId, current.value ?? 0);

    broadcastToSession(sessionId, "trendPlayed", { trendId });
  } else if (action === "stopTrend") {
    const { trendId } = data;
    await db
      .update(trends)
      .set({ incrementRate: 0, isPaused: false })
      .where(eq(trends.id, trendId));

    const current = await db.query.trends.findFirst({
      where: eq(trends.id, trendId),
    });
    if (current) setFloatValue(trendId, current.value ?? 0);

    broadcastToSession(sessionId, "trendStopped", { trendId });
  } else if (action === "deleteTrend") {
    const { trendId } = data;
    await db.delete(trends).where(eq(trends.id, trendId));
    clearFloatValue(trendId);

    broadcastToSession(sessionId, "trendDeleted", { trendId });
  } else if (action === "revealTrend") {
    const { trendId } = data;
    await db
      .update(trends)
      .set({ isHidden: false })
      .where(eq(trends.id, trendId));

    broadcastToSession(sessionId, "trendRevealed", {
      trendId,
    });
  } else if (action === "hideTrend") {
    const { trendId } = data;
    await db
      .update(trends)
      .set({ isHidden: true })
      .where(eq(trends.id, trendId));

    broadcastToSession(sessionId, "trendHidden", {
      trendId,
    });
  } else if (action === "pauseAllTrends") {
    const trendsList = await db.query.trends.findMany({
      where: eq(trends.sessionId, sessionId),
    });

    for (const trend of trendsList) {
      await db.update(trends).set({ isPaused: true }).where(eq(trends.id, trend.id));
    }

    broadcastToSession(sessionId, "allTrendsPaused", {});
  } else if (action === "playAllTrends") {
    const trendsList = await db.query.trends.findMany({
      where: eq(trends.sessionId, sessionId),
    });

    for (const trend of trendsList) {
      await db.update(trends).set({ isPaused: false }).where(eq(trends.id, trend.id));
      // Rebase so resuming doesn't jump using stale accumulated floats.
      setFloatValue(trend.id, trend.value ?? 0);
    }

    broadcastToSession(sessionId, "allTrendsPlayed", {});
  } else if (action === "triggerTakeover") {
    // Look up the takeover trend to include its data in broadcast
    const takeoverTrend = await db.query.trends.findFirst({
      where: and(
        eq(trends.sessionId, sessionId),
        eq(trends.isTakeoverTrend, true)
      ),
    });

    const payload: any = { ...data };
    if (takeoverTrend) {
      payload.trendId = takeoverTrend.id;
      payload.trendName = takeoverTrend.name;
      payload.trendValue = takeoverTrend.value;
      payload.imagePath = takeoverTrend.imagePath;
      payload.color = takeoverTrend.color;
    }

    broadcastToSession(sessionId, "takeoverTriggered", payload);
  } else if (action === "setTakeoverTrend") {
    const { trendId } = data;

    // Verify trend exists and belongs to this session
    const targetTrend = await db.query.trends.findFirst({
      where: eq(trends.id, trendId),
    });

    if (!targetTrend || targetTrend.sessionId !== sessionId) {
      return Response.json({ error: "Trend not found" }, { status: 404 });
    }

    // Unset isTakeoverTrend on any other trend in this session
    const otherTrends = await db.query.trends.findMany({
      where: eq(trends.sessionId, sessionId),
    });

    for (const t of otherTrends) {
      if (t.id !== trendId && t.isTakeoverTrend) {
        await db
          .update(trends)
          .set({ isTakeoverTrend: false })
          .where(eq(trends.id, t.id));
      }
    }

    // Set this trend as takeover trend and hide it
    await db
      .update(trends)
      .set({ isTakeoverTrend: true, isHidden: true })
      .where(eq(trends.id, trendId));

    // If no rampStages, auto-apply a sensible preset (steep curve from 70% to 100%)
    if (!targetTrend.rampStages) {
      const preset = JSON.stringify([
        { pct: 0, rate: 1 },
        { pct: 70, rate: 5 },
        { pct: 100, rate: 100 },
      ]);
      await db
        .update(trends)
        .set({ rampStages: preset })
        .where(eq(trends.id, trendId));
    }

    broadcastToSession(sessionId, "takeoverTrendSet", { trendId });
  } else if (action === "clearTakeoverTrend") {
    const { trendId } = data;

    // Verify trend exists
    const targetTrend = await db.query.trends.findFirst({
      where: eq(trends.id, trendId),
    });

    if (!targetTrend || targetTrend.sessionId !== sessionId) {
      return Response.json({ error: "Trend not found" }, { status: 404 });
    }

    // Just unset the flag, leave isHidden as-is
    await db
      .update(trends)
      .set({ isTakeoverTrend: false })
      .where(eq(trends.id, trendId));

    broadcastToSession(sessionId, "takeoverTrendCleared", { trendId });
  } else if (action === "resetSession") {
    // Reset all trend values
    const trendsList = await db.query.trends.findMany({
      where: eq(trends.sessionId, sessionId),
    });

    for (const trend of trendsList) {
      await db.update(trends).set({ value: 0 }).where(eq(trends.id, trend.id));
      setFloatValue(trend.id, 0);
    }

    // Back to a stopped clock so a scheduled takeover recomputes cleanly when
    // the session is started again.
    await db
      .update(sessions)
      .set({ startedAt: Date.now(), status: "stopped" })
      .where(eq(sessions.id, sessionId));
    clearAutoFired(sessionId);

    broadcastToSession(sessionId, "sessionReset", {});
  } else if (action === "startSession") {
    // Starting (re)bases the clock so elapsed time counts from this moment.
    const startedAt = Date.now();
    await db
      .update(sessions)
      .set({ status: "active", startedAt })
      .where(eq(sessions.id, sessionId));
    clearAutoFired(sessionId);

    broadcastToSession(sessionId, "sessionStarted", { startedAt });
  } else if (action === "stopSession") {
    await db
      .update(sessions)
      .set({ status: "stopped" })
      .where(eq(sessions.id, sessionId));

    broadcastToSession(sessionId, "sessionStopped", {});
  } else if (action === "updateConfig") {
    const { visibleCount, takeoverWindowMinutes, expectedDurationMinutes } =
      data;
    await db
      .update(sessions)
      .set({
        visibleCount,
        takeoverWindowMinutes,
        expectedDurationMinutes,
      })
      .where(eq(sessions.id, sessionId));

    broadcastToSession(sessionId, "configUpdated", {
      visibleCount,
      takeoverWindowMinutes,
      expectedDurationMinutes,
    });
  }

  return Response.json(result);
}

import { registerClient, broadcastToSession } from "@/lib/sse";
import { db } from "@/lib/db";
import { sessions, trends } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Broadcast update
    broadcastToSession(sessionId, "trendUpdated", {
      trendId,
      value,
    });
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
  } else if (action === "triggerTakeover") {
    // Notify all clients of takeover
    broadcastToSession(sessionId, "takeoverTriggered", data);
  } else if (action === "resetSession") {
    // Reset all trend values
    const trendsList = await db.query.trends.findMany({
      where: eq(trends.sessionId, sessionId),
    });

    for (const trend of trendsList) {
      await db.update(trends).set({ value: 0 }).where(eq(trends.id, trend.id));
    }

    broadcastToSession(sessionId, "sessionReset", {});
  } else if (action === "updateConfig") {
    const { visibleCount, takeoverWindowMinutes } = data;
    await db
      .update(sessions)
      .set({
        visibleCount,
        takeoverWindowMinutes,
      })
      .where(eq(sessions.id, sessionId));

    broadcastToSession(sessionId, "configUpdated", {
      visibleCount,
      takeoverWindowMinutes,
    });
  }

  return Response.json(result);
}

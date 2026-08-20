// Drives per-trend auto-increment ("rate of increment" set by admin, units/minute).
// Single in-process tick loop — fine since app runs as one self-hosted Node process.
import { db } from "./db";
import { trends, sessions } from "./db/schema";
import { eq, gt, and, or, isNotNull } from "drizzle-orm";
import { broadcastToSession } from "./sse";

const TICK_MS = 1000;

let started = false;
// Fractional running value per trend, so a 1/min rate still moves smoothly
// across many 1s ticks instead of losing everything to rounding each time.
const floatValues = new Map<string, number>();

// Sessions whose scheduled takeover has already auto-fired, so we don't
// re-broadcast every tick once the window has passed.
const autoFired = new Set<string>();

export function clearAutoFired(sessionId: string) {
  autoFired.delete(sessionId);
}

export function ensureTickerStarted() {
  if (started) return;
  started = true;
  const interval = setInterval(tick, TICK_MS);
  interval.unref?.();
}

export function setFloatValue(trendId: string, value: number) {
  floatValues.set(trendId, value);
}

export function clearFloatValue(trendId: string) {
  floatValues.delete(trendId);
}

async function tick() {
  try {
    await checkScheduledTakeovers();

    // Only sessions an admin has started should move; stopped/ended ones freeze.
    const runningSessions = await db.query.sessions.findMany({
      where: eq(sessions.status, "active"),
    });
    const runningSessionIds = new Set<string>();
    for (const session of runningSessions) {
      // Once the configured duration has fully elapsed, the clock reads
      // 0:00 — ticking must stop right along with it, not run forever.
      if (session.expectedDurationMinutes) {
        const elapsedMs = Date.now() - session.startedAt;
        const totalMs = session.expectedDurationMinutes * 60_000;
        if (elapsedMs >= totalMs) {
          await db
            .update(sessions)
            .set({ status: "stopped" })
            .where(eq(sessions.id, session.id));
          broadcastToSession(session.id, "sessionStopped", {});
          continue;
        }
      }
      runningSessionIds.add(session.id);
    }
    if (runningSessionIds.size === 0) return;

    // A trend can move via its flat incrementRate OR via ramp stages even
    // when incrementRate is 0 (ramp stages are meant to override a flat
    // rate of 0) — must not filter ramp-stage trends out here.
    const active = await db.query.trends.findMany({
      where: or(gt(trends.incrementRate, 0), isNotNull(trends.rampStages)),
    });

    for (const trend of active) {
      if (trend.isPaused) continue;
      if (!runningSessionIds.has(trend.sessionId)) continue;

      // Determine effective rate: use ramp stages if present, else flat rate
      let effectiveRate = trend.incrementRate ?? 0;

      if (trend.rampStages) {
        try {
          const stages = JSON.parse(trend.rampStages) as Array<{
            pct: number;
            rate: number;
          }>;
          if (stages.length > 0) {
            // Look up session to compute elapsed percentage
            const session = await db.query.sessions.findFirst({
              where: eq(sessions.id, trend.sessionId),
            });

            if (
              session &&
              session.expectedDurationMinutes &&
              session.status === "active"
            ) {
              const elapsedMs = Date.now() - session.startedAt;
              const totalMs = session.expectedDurationMinutes * 60_000;
              let elapsedPct = (elapsedMs / totalMs) * 100;
              elapsedPct = Math.max(0, Math.min(100, elapsedPct));

              // Build interpolation points, prepending (0, 0) if needed.
              // Sort ascending first — the admin UI doesn't enforce stage
              // order, and interpolation below assumes it.
              const points = [...stages].sort((a, b) => a.pct - b.pct);
              if (points[0].pct > 0) {
                points.unshift({ pct: 0, rate: 0 });
              }

              // Find bracketing points and interpolate
              for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];

                if (elapsedPct >= p1.pct && elapsedPct <= p2.pct) {
                  const t =
                    p2.pct === p1.pct
                      ? 0
                      : (elapsedPct - p1.pct) / (p2.pct - p1.pct);
                  effectiveRate = p1.rate + t * (p2.rate - p1.rate);
                  break;
                } else if (elapsedPct > p2.pct && i === points.length - 2) {
                  // Past the last point, hold at last rate
                  effectiveRate = p2.rate;
                  break;
                }
              }
            }
          }
        } catch (parseErr) {
          // JSON parse failed, fall back to flat rate
          effectiveRate = trend.incrementRate ?? 0;
        }
      }

      const current = floatValues.has(trend.id)
        ? floatValues.get(trend.id)!
        : trend.value ?? 0;

      const next = current + effectiveRate / 60;
      floatValues.set(trend.id, next);

      const rounded = Math.round(next);
      if (rounded !== trend.value) {
        await db.update(trends).set({ value: rounded }).where(eq(trends.id, trend.id));
        broadcastToSession(trend.sessionId, "trendUpdated", {
          trendId: trend.id,
          value: rounded,
        });
      }
    }
  } catch (error) {
    console.error("Ticker tick failed:", error);
  }
}

async function checkScheduledTakeovers() {
  const activeSessions = await db.query.sessions.findMany({
    where: eq(sessions.status, "active"),
  });

  for (const session of activeSessions) {
    if (
      !session.expectedDurationMinutes ||
      session.takeoverWindowMinutes == null ||
      autoFired.has(session.id)
    ) {
      continue;
    }

    const elapsedMs = Date.now() - session.startedAt;
    const triggerAtMs =
      (session.expectedDurationMinutes - session.takeoverWindowMinutes) *
      60_000;

    if (elapsedMs >= triggerAtMs) {
      autoFired.add(session.id);

      // Look up the takeover trend for this session to include its data
      const takeoverTrend = await db.query.trends.findFirst({
        where: and(
          eq(trends.sessionId, session.id),
          eq(trends.isTakeoverTrend, true)
        ),
      });

      const takeoverData: any = {
        triggeredAt: Date.now(),
        auto: true,
      };

      if (takeoverTrend) {
        takeoverData.trendId = takeoverTrend.id;
        takeoverData.trendName = takeoverTrend.name;
        takeoverData.trendValue = takeoverTrend.value;
        takeoverData.imagePath = takeoverTrend.imagePath;
        takeoverData.color = takeoverTrend.color;
      }

      broadcastToSession(session.id, "takeoverTriggered", takeoverData);
    }
  }
}

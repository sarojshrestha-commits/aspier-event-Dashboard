"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Trend {
  id: string;
  name: string;
  value: number;
  isHidden: boolean;
  position: number;
  imagePath?: string;
  color?: string | null;
}

interface Session {
  id: string;
  name: string;
  visibleCount: number;
  status: string;
  startedAt: number;
  expectedDurationMinutes: number | null;
  backgroundImagePath?: string | null;
}

function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
}

export default function TVPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [takeoverActive, setTakeoverActive] = useState(false);
  const [takeoverTrendId, setTakeoverTrendId] = useState<string | null>(null);
  // null until mounted so server and client markup match
  const [now, setNow] = useState<Date | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadSessionData();

    // Subscribe to SSE updates
    const eventSource = new EventSource(
      `/api/sessions/${sessionId}/events`
    );

    eventSource.addEventListener("trendUpdated", (event) => {
      const data = JSON.parse(event.data);
      setTrends((prev) =>
        prev.map((t) =>
          t.id === data.trendId ? { ...t, value: data.value } : t
        )
      );
      setLastUpdated(new Date());
    });

    eventSource.addEventListener("takeoverTriggered", (event) => {
      // During takeover, show the takeover trend data from the broadcast
      const data = JSON.parse(event.data);
      setTakeoverActive(true);

      // Use the trend data directly from the broadcast if available.
      // Stays showing until the admin explicitly reveals or hides it again
      // — no auto-revert timer. Per spec, that decision is the admin's,
      // not automatic.
      if (data.trendId) {
        setTakeoverTrendId(data.trendId);
        const takeoverTrend: Trend = {
          id: data.trendId,
          name: data.trendName,
          value: data.trendValue,
          isHidden: true,
          position: 0,
          imagePath: data.imagePath ?? undefined,
          color: data.color ?? undefined,
        };
        setTrends([takeoverTrend]);
      } else {
        // Fallback: try to find hidden trend (for backward compatibility)
        setTrends((prev) => {
          const hiddenTrend = prev.find((t) => t.isHidden);
          if (hiddenTrend) {
            setTakeoverTrendId(hiddenTrend.id);
            return [hiddenTrend];
          }
          return prev;
        });
      }
    });

    eventSource.addEventListener("trendCreated", () => {
      loadSessionData();
    });

    eventSource.addEventListener("trendConfigUpdated", () => {
      loadSessionData();
    });

    eventSource.addEventListener("trendHidden", () => {
      loadSessionData();
    });

    eventSource.addEventListener("trendRevealed", () => {
      loadSessionData();
    });

    eventSource.addEventListener("trendDeleted", () => {
      loadSessionData();
    });

    eventSource.addEventListener("sessionStarted", () => {
      loadSessionData();
    });

    eventSource.addEventListener("sessionStopped", () => {
      loadSessionData();
    });

    eventSource.addEventListener("sessionReset", () => {
      loadSessionData();
    });

    eventSource.addEventListener("configUpdated", (event) => {
      loadSessionData();
    });

    eventSource.addEventListener("backgroundUpdated", () => {
      loadSessionData();
    });

    return () => eventSource.close();
  }, [sessionId]);

  async function loadSessionData() {
    try {
      // Any real data refresh means we're not in an active takeover moment
      // anymore (that state only comes from the takeoverTriggered event,
      // which never calls this) — so always drop the stale banner/lock here
      // rather than depending on every individual event to remember to.
      setTakeoverActive(false);
      setTakeoverTrendId(null);

      const sessionResponse = await fetch(`/api/sessions/${sessionId}`);
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        setSession(sessionData);
      }

      const trendsResponse = await fetch(`/api/sessions/${sessionId}/trends`);
      if (trendsResponse.ok) {
        const trendsData = await trendsResponse.json();
        // Filter out hidden trends and limit to visibleCount
        const filtered = trendsData
          .filter((t: Trend) => !t.isHidden)
          .sort((a: Trend, b: Trend) => b.value - a.value)
          .slice(0, session?.visibleCount || 5);
        setTrends(filtered);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to load session data:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <p className="text-neutral-400 text-xl">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <p className="text-neutral-400 text-xl">Session not found</p>
      </div>
    );
  }

  const maxValue = Math.max(...trends.map((t) => t.value), 1);

  const isRunning = session.status === "active";
  const elapsedMs =
    isRunning && now ? now.getTime() - session.startedAt : 0;
  const durationMs = session.expectedDurationMinutes
    ? session.expectedDurationMinutes * 60_000
    : null;
  const remainingMs = durationMs != null ? durationMs - elapsedMs : null;

  return (
    <div
      className="w-full h-screen bg-white relative"
      style={
        session.backgroundImagePath
          ? {
              backgroundImage: `url(${session.backgroundImagePath})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {session.backgroundImagePath && (
        <div className="absolute inset-0 bg-white/85" />
      )}
      <div className="relative h-full flex flex-col">
      <header className="px-10 py-8 border-b border-neutral-100 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900 tracking-tight">
            {session.name}
          </h1>
          {takeoverActive && (
            <p className="text-sm font-medium text-neutral-500 mt-1 uppercase tracking-widest">
              Takeover
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-3">
          {(durationMs != null || isRunning) && (
            <div className="text-right">
              <p className="text-3xl font-semibold text-neutral-900 tracking-tight tabular-nums">
                {remainingMs != null
                  ? formatClock(remainingMs)
                  : formatClock(elapsedMs)}
              </p>
            </div>
          )}
          <div className="text-right">
            <p className="text-base font-medium text-neutral-500 tracking-tight tabular-nums">
              {now
                ? now.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "--:--:--"}
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {now
                ? now.toLocaleDateString([], {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })
                : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-10 overflow-hidden flex flex-col justify-center">
        <div className="space-y-5 max-w-5xl mx-auto w-full">
          {trends.length === 0 ? (
            <p className="text-neutral-400 text-lg text-center">
              No trends to display
            </p>
          ) : (
            trends
              .sort((a, b) => b.value - a.value)
              .map((trend, index) => (
                <div key={trend.id} className="flex items-center gap-5">
                  <span className="text-neutral-300 text-xl font-semibold w-10 text-right tabular-nums">
                    {index + 1}
                  </span>
                  <div className="flex items-center gap-2 w-48">
                    {trend.imagePath && (
                      <img
                        src={trend.imagePath}
                        alt={trend.name}
                        className="h-8 w-8 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <span className="text-neutral-900 text-lg font-medium truncate">
                      {trend.name}
                    </span>
                  </div>
                  <div className="flex-1 bg-neutral-100 rounded-md h-10 overflow-hidden">
                    <div
                      className="h-full rounded-md transition-all duration-700 ease-out"
                      style={{
                        width: `${(trend.value / maxValue) * 100}%`,
                        backgroundColor: trend.color || "#171717",
                      }}
                    />
                  </div>
                  <span className="text-neutral-900 text-lg font-semibold w-20 text-right tabular-nums">
                    {formatNumber(trend.value)}
                  </span>
                </div>
              ))
          )}
        </div>
      </main>

      <footer className="px-10 py-4 border-t border-neutral-100 text-center text-neutral-300 text-xs">
        Live · updated {lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}
      </footer>
      </div>
    </div>
  );
}

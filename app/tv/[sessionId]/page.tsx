"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Trend {
  id: string;
  name: string;
  value: number;
  isHidden: boolean;
  position: number;
}

interface Session {
  id: string;
  name: string;
  visibleCount: number;
  status: string;
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
    });

    eventSource.addEventListener("takeoverTriggered", (event) => {
      // During takeover, only show the hidden trend
      const data = JSON.parse(event.data);
      setTakeoverActive(true);
      // Find the hidden trend
      setTrends((prev) => {
        const hiddenTrend = prev.find((t) => t.isHidden);
        if (hiddenTrend) {
          setTakeoverTrendId(hiddenTrend.id);
          return [hiddenTrend];
        }
        return prev;
      });

      // Auto-end takeover after 30 seconds
      setTimeout(() => {
        setTakeoverActive(false);
        setTakeoverTrendId(null);
        loadSessionData();
      }, 30000);
    });

    eventSource.addEventListener("sessionReset", () => {
      loadSessionData();
    });

    eventSource.addEventListener("configUpdated", (event) => {
      loadSessionData();
    });

    return () => eventSource.close();
  }, [sessionId]);

  async function loadSessionData() {
    try {
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
    } catch (error) {
      console.error("Failed to load session data:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700">
        <p className="text-white text-2xl">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-red-900 to-red-700">
        <p className="text-white text-2xl">Session not found</p>
      </div>
    );
  }

  const maxValue = Math.max(...trends.map((t) => t.value), 1);
  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-orange-500",
    "bg-green-500",
    "bg-red-500",
    "bg-cyan-500",
    "bg-indigo-500",
  ];

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col">
      <header className="bg-black bg-opacity-50 p-6 text-white">
        <h1 className="text-4xl font-bold">{session.name}</h1>
        {takeoverActive && (
          <p className="text-xl text-yellow-300 mt-2">🔥 TAKEOVER MODE 🔥</p>
        )}
      </header>

      <main className="flex-1 p-8 overflow-hidden flex flex-col justify-center">
        <div className="space-y-6">
          {trends.length === 0 ? (
            <p className="text-white text-xl">No trends to display</p>
          ) : (
            trends
              .sort((a, b) => b.value - a.value)
              .map((trend, index) => (
                <div key={trend.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 w-1/4">
                      <span className="text-white text-2xl font-bold w-12">
                        #{index + 1}
                      </span>
                      <span className="text-white text-xl font-semibold">
                        {trend.name}
                      </span>
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="bg-slate-700 rounded-full h-12 overflow-hidden">
                        <div
                          className={`h-full ${
                            colors[index % colors.length]
                          } transition-all duration-500`}
                          style={{
                            width: `${(trend.value / maxValue) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-white text-2xl font-bold w-24 text-right">
                      {formatNumber(trend.value)}
                    </span>
                  </div>
                </div>
              ))
          )}
        </div>
      </main>

      <footer className="bg-black bg-opacity-50 p-4 text-center text-gray-400 text-sm">
        Live Leaderboard • Last updated:{" "}
        {new Date().toLocaleTimeString()}
      </footer>
    </div>
  );
}

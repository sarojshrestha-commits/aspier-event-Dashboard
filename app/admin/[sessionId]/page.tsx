"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { layout, surface, text, formGroup, fieldGap, badge } from "@/lib/design";
import Link from "next/link";
import { Play, Pause, Square, Trash2, Eye, EyeOff, Crown, Plus, ChevronRight, Tv, MoreHorizontal, Pencil, Upload } from "lucide-react";
import { AddTrendSheet } from "@/components/add-trend-sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Trend {
  id: string;
  name: string;
  value: number;
  incrementRate: number;
  isPaused: boolean;
  isHidden: boolean;
  position: number;
  imagePath?: string;
  rampStages?: string;
  isTakeoverTrend?: boolean;
  color?: string | null;
}

interface Session {
  id: string;
  name: string;
  status: string;
  visibleCount: number;
  takeoverWindowMinutes: number | null;
  expectedDurationMinutes: number | null;
  backgroundImagePath?: string | null;
  startedAt: number;
}

export default function AdminControlPanel() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTrendObj, setEditingTrendObj] = useState<Trend | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const [visibleCount, setVisibleCount] = useState(5);
  const [takeoverWindow, setTakeoverWindow] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [editingTrend, setEditingTrend] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
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
    });

    eventSource.addEventListener("trendRateUpdated", (event) => {
      const data = JSON.parse(event.data);
      setTrends((prev) =>
        prev.map((t) =>
          t.id === data.trendId
            ? { ...t, incrementRate: data.incrementRate }
            : t
        )
      );
    });

    eventSource.addEventListener("trendConfigUpdated", () => {
      loadSessionData();
    });

    eventSource.addEventListener("trendPaused", (event) => {
      const data = JSON.parse(event.data);
      setTrends((prev) =>
        prev.map((t) =>
          t.id === data.trendId ? { ...t, isPaused: true } : t
        )
      );
    });

    eventSource.addEventListener("trendPlayed", (event) => {
      const data = JSON.parse(event.data);
      setTrends((prev) =>
        prev.map((t) =>
          t.id === data.trendId ? { ...t, isPaused: false } : t
        )
      );
    });

    eventSource.addEventListener("trendStopped", (event) => {
      const data = JSON.parse(event.data);
      setTrends((prev) =>
        prev.map((t) =>
          t.id === data.trendId
            ? { ...t, incrementRate: 0, isPaused: false }
            : t
        )
      );
    });

    eventSource.addEventListener("trendDeleted", (event) => {
      const data = JSON.parse(event.data);
      setTrends((prev) => prev.filter((t) => t.id !== data.trendId));
    });

    eventSource.addEventListener("trendHidden", (event) => {
      const data = JSON.parse(event.data);
      setTrends((prev) =>
        prev.map((t) => (t.id === data.trendId ? { ...t, isHidden: true } : t))
      );
    });

    eventSource.addEventListener("trendRevealed", (event) => {
      const data = JSON.parse(event.data);
      setTrends((prev) =>
        prev.map((t) =>
          t.id === data.trendId ? { ...t, isHidden: false } : t
        )
      );
    });

    eventSource.addEventListener("allTrendsPaused", () => {
      setTrends((prev) => prev.map((t) => ({ ...t, isPaused: true })));
    });

    eventSource.addEventListener("allTrendsPlayed", () => {
      setTrends((prev) => prev.map((t) => ({ ...t, isPaused: false })));
    });

    eventSource.addEventListener("sessionReset", () => {
      loadSessionData();
    });

    eventSource.addEventListener("sessionStarted", () => {
      loadSessionData();
    });

    eventSource.addEventListener("sessionStopped", () => {
      loadSessionData();
    });

    eventSource.addEventListener("configUpdated", (event) => {
      const data = JSON.parse(event.data);
      setVisibleCount(data.visibleCount);
      setTakeoverWindow(data.takeoverWindowMinutes);
      setDurationMinutes(data.expectedDurationMinutes);
    });

    return () => eventSource.close();
  }, [sessionId]);

  async function loadSessionData() {
    try {
      const sessionResponse = await fetch(`/api/sessions/${sessionId}`);
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        setSession(sessionData);
        setVisibleCount(sessionData.visibleCount);
        setTakeoverWindow(sessionData.takeoverWindowMinutes);
        setDurationMinutes(sessionData.expectedDurationMinutes);
      }

      const trendsResponse = await fetch(`/api/sessions/${sessionId}/trends`);
      if (trendsResponse.ok) {
        const trendsData = await trendsResponse.json();
        setTrends(trendsData.sort((a: Trend, b: Trend) => a.position - b.position));
      }
    } catch (error) {
      console.error("Failed to load session data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveTrend(data: {
    id?: string;
    name: string;
    incrementRate: number;
    imageFile?: File;
    rampStages?: string;
    isTakeoverTrend?: boolean;
    color?: string;
  }) {
    try {
      let trendId = data.id;

      if (trendId) {
        // Editing an existing trend
        await fetch(`/api/sessions/${sessionId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateTrendConfig",
            data: {
              trendId,
              name: data.name,
              incrementRate: data.incrementRate,
              rampStages: data.rampStages,
              color: data.color,
            },
          }),
        });
      } else {
        const response = await fetch(`/api/sessions/${sessionId}/trends`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            incrementRate: data.incrementRate,
            rampStages: data.rampStages,
            isTakeoverTrend: data.isTakeoverTrend,
            color: data.color,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create trend");
        }

        const newTrend = await response.json();
        trendId = newTrend.id;
      }

      if (data.imageFile && trendId) {
        const formData = new FormData();
        formData.append("file", data.imageFile);
        await fetch(`/api/uploads?trendId=${trendId}`, {
          method: "POST",
          body: formData,
        });
      }

      // Reconcile the takeover flag against whatever it currently was —
      // must handle both turning it on AND turning it off on an edit.
      if (trendId) {
        const wasTakeover = data.id ? editingTrendObj?.isTakeoverTrend : false;
        if (data.isTakeoverTrend && !wasTakeover) {
          await fetch(`/api/sessions/${sessionId}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "setTakeoverTrend",
              data: { trendId },
            }),
          });
        } else if (!data.isTakeoverTrend && wasTakeover) {
          await fetch(`/api/sessions/${sessionId}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "clearTakeoverTrend",
              data: { trendId },
            }),
          });
        }
      }

      setEditingTrendObj(null);
      loadSessionData();
    } catch (error) {
      console.error("Failed to save trend:", error);
    }
  }

  async function updateTrendValue(trendId: string, value: number) {
    try {
      await fetch(`/api/sessions/${sessionId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateTrendValue",
          data: { trendId, value },
        }),
      });
    } catch (error) {
      console.error("Failed to update trend:", error);
    }
  }

  async function sendTrendAction(action: string, trendId: string) {
    try {
      await fetch(`/api/sessions/${sessionId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: { trendId } }),
      });
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
    }
  }

  async function setTakeoverTrend(trendId: string) {
    await sendTrendAction("setTakeoverTrend", trendId);
  }

  async function clearTakeoverTrend(trendId: string) {
    await sendTrendAction("clearTakeoverTrend", trendId);
  }

  async function deleteTrend(trendId: string) {
    if (!confirm("Delete this trend? This cannot be undone.")) return;
    await sendTrendAction("deleteTrend", trendId);
  }

  async function sendSessionAction(action: string) {
    try {
      await fetch(`/api/sessions/${sessionId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: {} }),
      });
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
    }
  }

  async function saveConfig() {
    try {
      await fetch(`/api/sessions/${sessionId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateConfig",
          data: {
          visibleCount,
          takeoverWindowMinutes: takeoverWindow,
          expectedDurationMinutes: durationMinutes,
        },
        }),
      });
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  }

  async function handleBackgroundSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    setBgUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/uploads?sessionId=${sessionId}`, {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        loadSessionData();
      }
    } catch (error) {
      console.error("Failed to upload background:", error);
    } finally {
      setBgUploading(false);
      if (bgFileInputRef.current) bgFileInputRef.current.value = "";
    }
  }

  async function triggerTakeover() {
    try {
      await fetch(`/api/sessions/${sessionId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "triggerTakeover",
          data: { triggeredAt: Date.now() },
        }),
      });
    } catch (error) {
      console.error("Failed to trigger takeover:", error);
    }
  }

  async function resetSession() {
    if (
      !confirm(
        "Reset all trend values and stop the session clock? This cannot be undone."
      )
    )
      return;

    try {
      await fetch(`/api/sessions/${sessionId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetSession", data: {} }),
      });
    } catch (error) {
      console.error("Failed to reset session:", error);
    }
  }

  function formatClock(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  const isRunning = session?.status === "active";
  // A stopped session holds at zero — the clock only counts while running.
  const elapsedMs = isRunning && session && now ? now - session.startedAt : 0;
  const durationMs = session?.expectedDurationMinutes
    ? session.expectedDurationMinutes * 60_000
    : null;
  const remainingMs = durationMs != null ? durationMs - elapsedMs : null;

  if (loading) return <div className={layout.container}>Loading...</div>;
  if (!session)
    return <div className={layout.container}>Session not found</div>;

  return (
    <div className={layout.page}>
      <nav className={layout.nav}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <Link href="/admin" className="hover:text-foreground">
                Sessions
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground">{session.name}</span>
            </div>
            <h1 className={text.pageTitle}>{session.name}</h1>
            <p className={text.muted}>Status: {session.status}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/tv/${sessionId}`} target="_blank">
              <Button variant="outline" className="gap-1.5">
                <Tv className="h-4 w-4" />
                View TV
              </Button>
            </Link>
            <Button variant="outline" onClick={() => router.push("/admin")}>
              Back to Sessions
            </Button>
          </div>
        </div>
      </nav>

      <div className={layout.wideContainer}>
      <div className={layout.sidebarGrid}>
      <div className={layout.section}>
        {/* Session Clock */}
        <Card className={surface.card}>
          <h2 className={text.sectionTitle}>Session Clock</h2>
          {durationMs != null ? (
            <div>
              <p className="text-3xl font-semibold tabular-nums text-foreground">
                {formatClock(remainingMs ?? 0)}
              </p>
              <p className={text.muted}>
                {isRunning
                  ? `remaining · elapsed ${formatClock(elapsedMs)}`
                  : "stopped · starts counting when you start the session"}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-3xl font-semibold tabular-nums text-foreground">
                {formatClock(elapsedMs)}
              </p>
              <p className={text.muted}>
                {isRunning
                  ? "elapsed · set a session duration to see time remaining"
                  : "stopped · starts counting when you start the session"}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {isRunning ? (
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => sendSessionAction("stopSession")}
              >
                <Square className="h-4 w-4" />
                Stop Session
              </Button>
            ) : (
              <Button
                className="gap-1.5"
                onClick={() => sendSessionAction("startSession")}
              >
                <Play className="h-4 w-4" />
                Start Session
              </Button>
            )}
            <Button onClick={triggerTakeover}>Trigger Takeover Now</Button>
            <Button onClick={resetSession} variant="destructive">
              Reset Session
            </Button>
          </div>
        </Card>

        {/* Configuration */}
        <Card className={surface.card}>
          <h2 className={text.sectionTitle}>Configuration</h2>
          <div className={formGroup}>
            <div className={fieldGap}>
              <Label htmlFor="duration">Session Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                value={durationMinutes ?? ""}
                onChange={(e) =>
                  setDurationMinutes(
                    e.target.value ? parseInt(e.target.value) : null
                  )
                }
                placeholder="e.g. 120 for a 2 hour event"
              />
            </div>
            <div className={fieldGap}>
              <Label htmlFor="visibleCount">Visible Trends Count</Label>
              <Input
                id="visibleCount"
                type="number"
                min="1"
                value={visibleCount}
                onChange={(e) => setVisibleCount(parseInt(e.target.value))}
              />
            </div>
            <div className={fieldGap}>
              <Label htmlFor="takeoverWindow">
                Takeover Window (minutes before end)
              </Label>
              <Input
                id="takeoverWindow"
                type="number"
                min="0"
                value={takeoverWindow || ""}
                onChange={(e) =>
                  setTakeoverWindow(
                    e.target.value ? parseInt(e.target.value) : null
                  )
                }
                placeholder="Leave empty to disable auto-takeover"
              />
              <p className={text.muted}>
                Requires session duration above — fires automatically once
                that many minutes remain, based on when this session was
                created or last reset.
              </p>
            </div>
            <div className={fieldGap}>
              <Label>TV Background Image</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => bgFileInputRef.current?.click()}
                  disabled={bgUploading}
                  className="gap-1.5"
                >
                  <Upload className="h-4 w-4" />
                  {bgUploading ? "Uploading..." : "Upload"}
                </Button>
                {session.backgroundImagePath && (
                  <img
                    src={session.backgroundImagePath}
                    alt="Background preview"
                    className="h-9 w-16 rounded-md object-cover border border-border"
                  />
                )}
              </div>
              <input
                ref={bgFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleBackgroundSelect}
                className="hidden"
              />
              <p className={text.muted}>
                Shown full-bleed behind the leaderboard on the TV display.
              </p>
            </div>
            <Button onClick={saveConfig}>Save Configuration</Button>
          </div>
        </Card>

      </div>

      <div>
        {/* Trends Management */}
        <Card className={surface.card}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={text.sectionTitle + " mb-0"}>Manage Trends</h2>
            <Button
              onClick={() => {
                setEditingTrendObj(null);
                setSheetOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              New Trend
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pb-6 mb-6 border-b border-border">
            <Button onClick={() => sendSessionAction("playAllTrends")}>
              Start All
            </Button>
            <Button
              onClick={() => sendSessionAction("pauseAllTrends")}
              variant="outline"
            >
              Stop All
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Rate/min</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trends
                .sort((a: Trend, b: Trend) => a.position - b.position)
                .map((trend) => (
                <TableRow key={trend.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {trend.imagePath && (
                        <img
                          src={trend.imagePath}
                          alt={trend.name}
                          className="h-8 w-8 rounded object-cover"
                        />
                      )}
                      <span>{trend.name}</span>
                      {trend.isHidden && <span className={badge}>Hidden</span>}
                      {trend.isTakeoverTrend && (
                        <span className={badge}>Takeover</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {editingTrend === trend.id ? (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="w-20"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            updateTrendValue(trend.id, parseInt(editingValue));
                            setEditingTrend(null);
                          }}
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{trend.value}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingTrend(trend.id);
                            setEditingValue(trend.value.toString());
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      let stages: { pct: number; rate: number }[] = [];
                      try {
                        stages = trend.rampStages
                          ? JSON.parse(trend.rampStages)
                          : [];
                      } catch {
                        stages = [];
                      }

                      if (stages.length > 0) {
                        const maxRate = Math.max(...stages.map((s) => s.rate), 1);
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium bg-accent text-accent-foreground px-2 py-1 rounded-md shrink-0">
                              Ramped
                            </span>
                            <svg
                              width="60"
                              height="20"
                              viewBox="0 0 60 20"
                              className="shrink-0"
                            >
                              <polyline
                                points={stages
                                  .map(
                                    (s) =>
                                      `${(s.pct / 100) * 60},${
                                        20 - (s.rate / maxRate) * 18
                                      }`
                                  )
                                  .join(" ")}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="text-foreground"
                              />
                            </svg>
                            <span className={text.muted}>
                              {stages[stages.length - 1].rate}/min peak
                            </span>
                          </div>
                        );
                      }

                      return (
                        <span className="text-muted-foreground">
                          {trend.incrementRate || 0}/min
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        title={trend.isPaused ? "Play" : "Pause"}
                        onClick={() =>
                          sendTrendAction(
                            trend.isPaused ? "playTrend" : "pauseTrend",
                            trend.id
                          )
                        }
                      >
                        {trend.isPaused ? (
                          <Play className="h-3.5 w-3.5" />
                        ) : (
                          <Pause className="h-3.5 w-3.5" />
                        )}
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button size="icon-sm" variant="outline" title="More">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingTrendObj(trend);
                              setSheetOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => sendTrendAction("stopTrend", trend.id)}
                          >
                            <Square className="h-3.5 w-3.5" />
                            Stop (zero the rate)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              sendTrendAction(
                                trend.isHidden ? "revealTrend" : "hideTrend",
                                trend.id
                              )
                            }
                          >
                            {trend.isHidden ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                            {trend.isHidden ? "Reveal" : "Hide"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              trend.isTakeoverTrend
                                ? clearTakeoverTrend(trend.id)
                                : setTakeoverTrend(trend.id)
                            }
                          >
                            <Crown className="h-3.5 w-3.5" />
                            {trend.isTakeoverTrend
                              ? "Clear takeover"
                              : "Set as takeover"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => deleteTrend(trend.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <AddTrendSheet
          open={sheetOpen}
          onOpenChange={(open) => {
            setSheetOpen(open);
            if (!open) setEditingTrendObj(null);
          }}
          onSubmit={saveTrend}
          editingTrend={editingTrendObj}
        />
      </div>
      </div>
      </div>
      </div>
  );
}

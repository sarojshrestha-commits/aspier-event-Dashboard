"use client";

import { useEffect, useState } from "react";
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
  status: string;
  visibleCount: number;
  takeoverWindowMinutes: number | null;
}

export default function AdminControlPanel() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTrendName, setNewTrendName] = useState("");
  const [visibleCount, setVisibleCount] = useState(5);
  const [takeoverWindow, setTakeoverWindow] = useState<number | null>(null);
  const [editingTrend, setEditingTrend] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

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

    eventSource.addEventListener("sessionReset", () => {
      loadSessionData();
    });

    eventSource.addEventListener("configUpdated", (event) => {
      const data = JSON.parse(event.data);
      setVisibleCount(data.visibleCount);
      setTakeoverWindow(data.takeoverWindowMinutes);
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

  async function addTrend() {
    if (!newTrendName.trim()) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}/trends`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTrendName }),
      });

      if (response.ok) {
        setNewTrendName("");
        loadSessionData();
      }
    } catch (error) {
      console.error("Failed to add trend:", error);
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

  async function saveConfig() {
    try {
      await fetch(`/api/sessions/${sessionId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateConfig",
          data: { visibleCount, takeoverWindowMinutes: takeoverWindow },
        }),
      });
    } catch (error) {
      console.error("Failed to save config:", error);
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
    if (!confirm("Reset all trend values? This cannot be undone.")) return;

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

  if (loading) return <div className="p-8">Loading...</div>;
  if (!session) return <div className="p-8">Session not found</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{session.name}</h1>
              <p className="text-sm text-gray-600">Status: {session.status}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push("/admin")}
            >
              Back to Sessions
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Configuration */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="visibleCount">Visible Trends Count</Label>
              <Input
                id="visibleCount"
                type="number"
                min="1"
                value={visibleCount}
                onChange={(e) => setVisibleCount(parseInt(e.target.value))}
              />
            </div>
            <div>
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
            </div>
            <Button onClick={saveConfig}>Save Configuration</Button>
          </div>
        </Card>

        {/* Trends Management */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Manage Trends</h2>

          <div className="space-y-4 mb-6">
            <div>
              <Label htmlFor="newTrend">Add New Trend</Label>
              <div className="flex gap-2">
                <Input
                  id="newTrend"
                  placeholder="Trend name"
                  value={newTrendName}
                  onChange={(e) => setNewTrendName(e.target.value)}
                />
                <Button onClick={addTrend} disabled={!newTrendName.trim()}>
                  Add
                </Button>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trends
                .sort((a: Trend, b: Trend) => a.position - b.position)
                .map((trend) => (
                <TableRow key={trend.id}>
                  <TableCell>{trend.name}</TableCell>
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
                    {trend.isHidden && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        Hidden
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Actions */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Session Actions</h2>
          <div className="space-x-2">
            <Button onClick={triggerTakeover} className="bg-blue-600">
              Trigger Takeover Now
            </Button>
            <Button onClick={resetSession} variant="destructive">
              Reset Session
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

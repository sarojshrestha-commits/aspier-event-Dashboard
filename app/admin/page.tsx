"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { layout, surface, text, badge, sheetBody } from "@/lib/design";

interface Session {
  id: string;
  name: string;
  status: string;
  createdAt: number;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

export default function AdminPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSessionName, setNewSessionName] = useState("");
  const [newDuration, setNewDuration] = useState<string>("10");
  const [newVisibleCount, setNewVisibleCount] = useState<string>("5");
  const [newTakeoverWindow, setNewTakeoverWindow] = useState<string>("5");
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      const response = await fetch("/api/sessions");
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setLoading(false);
    }
  }

  async function createSession() {
    if (!newSessionName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSessionName,
          expectedDurationMinutes: newDuration ? parseInt(newDuration) : null,
          visibleCount: newVisibleCount ? parseInt(newVisibleCount) : 5,
          takeoverWindowMinutes: newTakeoverWindow
            ? parseInt(newTakeoverWindow)
            : null,
        }),
      });

      if (response.ok) {
        const session = await response.json();
        setNewSessionName("");
        setDialogOpen(false);
        loadSessions();
        router.push(`/admin/${session.id}`);
      }
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setCreating(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  async function deleteSession(id: string, name: string) {
    if (!confirm(`Delete session "${name}" and all its trends? This cannot be undone.`))
      return;

    try {
      const response = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  }

  return (
    <div className={layout.page}>
      <nav className={layout.nav}>
        <div className={layout.navInner}>
          <h1 className={text.pageTitle}>Aspire Events</h1>
          <Button variant="ghost" size="sm" onClick={logout}>
            Logout
          </Button>
        </div>
      </nav>

      <div className={layout.container}>
        <Card className={surface.card}>
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sessions..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
              <SheetTrigger
                render={
                  <Button className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    New Session
                  </Button>
                }
              />
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Create New Session</SheetTitle>
                </SheetHeader>
                <div className={sheetBody}>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Session Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Product Launch Event"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newDuration">
                      Session Duration (minutes)
                    </Label>
                    <Input
                      id="newDuration"
                      type="number"
                      min="1"
                      value={newDuration}
                      onChange={(e) => setNewDuration(e.target.value)}
                      placeholder="e.g. 120 for a 2 hour event"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newVisibleCount">Visible Trends Count</Label>
                    <Input
                      id="newVisibleCount"
                      type="number"
                      min="1"
                      value={newVisibleCount}
                      onChange={(e) => setNewVisibleCount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newTakeoverWindow">
                      Takeover Window (minutes before end)
                    </Label>
                    <Input
                      id="newTakeoverWindow"
                      type="number"
                      min="0"
                      value={newTakeoverWindow}
                      onChange={(e) => setNewTakeoverWindow(e.target.value)}
                      placeholder="Leave empty to disable auto-takeover"
                    />
                    <p className={text.muted}>
                      Requires session duration above — fires automatically once
                      that many minutes remain. The session is created stopped;
                      its clock starts when you start it.
                    </p>
                  </div>
                  <Button
                    onClick={createSession}
                    disabled={creating || !newSessionName.trim()}
                    className="w-full"
                  >
                    {creating ? "Creating..." : "Create Session"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {loading ? (
            <p className={text.muted}>Loading...</p>
          ) : sessions.length === 0 ? (
            <p className={text.muted}>No sessions yet. Create one above.</p>
          ) : (
            <div className="space-y-2">
              {sessions
                .filter((s) =>
                  s.name.toLowerCase().includes(query.toLowerCase())
                )
                .map((session) => (
                  <div key={session.id} className={surface.row}>
                    <div className="h-11 w-11 shrink-0 rounded-lg border border-border flex items-center justify-center font-semibold text-sm bg-card">
                      {initials(session.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">
                        {session.name}
                      </p>
                      <p className={text.label}>{session.id}</p>
                    </div>

                    <span className={badge}>{session.status}</span>

                    <div className="flex gap-2 shrink-0">
                      <Link href={`/admin/${session.id}`}>
                        <Button size="sm" variant="outline">
                          Manage
                        </Button>
                      </Link>
                      <Link href={`/tv/${session.id}`} target="_blank">
                        <Button size="sm" variant="outline">
                          View TV
                        </Button>
                      </Link>
                      <Button
                        size="icon-sm"
                        variant="destructive"
                        title="Delete session"
                        onClick={() => deleteSession(session.id, session.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Session {
  id: string;
  name: string;
  status: string;
  createdAt: number;
}

export default function AdminPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSessionName, setNewSessionName] = useState("");
  const [creating, setCreating] = useState(false);
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
        body: JSON.stringify({ name: newSessionName }),
      });

      if (response.ok) {
        const session = await response.json();
        setNewSessionName("");
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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Aspire Events</h1>
          <button
            onClick={logout}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Create New Session</h2>
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Session Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Product Launch Event"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                />
              </div>
              <Button
                onClick={createSession}
                disabled={creating || !newSessionName.trim()}
              >
                {creating ? "Creating..." : "Create Session"}
              </Button>
            </div>
          </Card>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Existing Sessions</h2>
          {loading ? (
            <p>Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="text-gray-600">No sessions yet. Create one above!</p>
          ) : (
            <div className="grid gap-4">
              {sessions.map((session) => (
                <Card key={session.id} className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold">{session.name}</h3>
                      <p className="text-sm text-gray-600">ID: {session.id}</p>
                      <p className="text-sm text-gray-600">
                        Status: {session.status}
                      </p>
                    </div>
                    <div className="space-x-2">
                      <Link href={`/admin/${session.id}`}>
                        <Button variant="outline">Manage</Button>
                      </Link>
                      <Link href={`/tv/${session.id}`} target="_blank">
                        <Button variant="outline">View TV</Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

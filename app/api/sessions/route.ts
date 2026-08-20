import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function GET() {
  const allSessions = await db.query.sessions.findMany();
  return Response.json(allSessions);
}

export async function POST(request: Request) {
  const {
    name,
    visibleCount,
    expectedDurationMinutes,
    takeoverWindowMinutes,
  } = await request.json();

  if (!name) {
    return Response.json({ error: "Name required" }, { status: 400 });
  }

  const toPositiveInt = (value: unknown) => {
    const parsed = typeof value === "string" ? parseInt(value) : value;
    return typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0
      ? Math.floor(parsed)
      : null;
  };

  const id = crypto.randomBytes(8).toString("hex");
  const now = Date.now();

  await db.insert(sessions).values({
    id,
    name,
    // Sessions are created stopped; the clock starts when an admin starts it.
    status: "stopped",
    startedAt: now,
    createdAt: now,
    visibleCount: toPositiveInt(visibleCount) ?? 5,
    expectedDurationMinutes: toPositiveInt(expectedDurationMinutes),
    takeoverWindowMinutes: toPositiveInt(takeoverWindowMinutes),
  });

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
  });

  return Response.json(session);
}

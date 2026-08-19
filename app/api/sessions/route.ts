import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function GET() {
  const allSessions = await db.query.sessions.findMany();
  return Response.json(allSessions);
}

export async function POST(request: Request) {
  const { name } = await request.json();

  if (!name) {
    return Response.json({ error: "Name required" }, { status: 400 });
  }

  const id = crypto.randomBytes(8).toString("hex");
  const now = Date.now();

  await db.insert(sessions).values({
    id,
    name,
    status: "active",
    startedAt: now,
    createdAt: now,
    visibleCount: 5,
  });

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
  });

  return Response.json(session);
}

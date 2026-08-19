import { db } from "@/lib/db";
import { trends, sessions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;

  const trendsList = await db.query.trends.findMany({
    where: eq(trends.sessionId, sessionId),
  });

  return Response.json(trendsList);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const { name } = await request.json();

  if (!name) {
    return Response.json({ error: "Name required" }, { status: 400 });
  }

  // Verify session exists
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  // Get max position
  const maxPositionTrend = await db.query.trends.findFirst({
    where: eq(trends.sessionId, sessionId),
    orderBy: [desc(trends.position)],
  });

  const position = (maxPositionTrend?.position || 0) + 1;
  const trendId = crypto.randomBytes(8).toString("hex");

  await db.insert(trends).values({
    id: trendId,
    sessionId,
    name,
    value: 0,
    isHidden: false,
    position,
  });

  const newTrend = await db.query.trends.findFirst({
    where: eq(trends.id, trendId),
  });

  return Response.json(newTrend);
}

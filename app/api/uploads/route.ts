import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { db } from "@/lib/db";
import { trends, sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { broadcastToSession } from "@/lib/sse";

const uploadsDir = path.join(process.cwd(), "data", "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function POST(request: Request) {
  const token = new Headers(request.headers).get("cookie");
  if (!token?.includes("aspier_session=")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const trendId = url.searchParams.get("trendId");
  const sessionId = url.searchParams.get("sessionId");

  if (!trendId && !sessionId) {
    return Response.json(
      { error: "trendId or sessionId query param required" },
      { status: 400 }
    );
  }

  if (trendId) {
    const trend = await db.query.trends.findFirst({
      where: eq(trends.id, trendId),
    });
    if (!trend) {
      return Response.json({ error: "Trend not found" }, { status: 404 });
    }
  } else if (sessionId) {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });
    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate it's an image, and derive the extension from the whitelisted
    // MIME type only — never trust the client-supplied filename for this,
    // it's an arbitrary-write vector otherwise.
    const ext = EXT_BY_MIME[file.type];
    if (!ext) {
      return Response.json({ error: "File must be an image" }, { status: 400 });
    }

    // Create uploads dir if it doesn't exist
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch {
      // dir already exists
    }

    // Generate filename
    const filename = `${crypto.randomBytes(8).toString("hex")}.${ext}`;
    const filepath = path.join(uploadsDir, filename);

    // Write file
    const buffer = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(buffer));

    const imageUrl = `/api/uploads/${filename}`;
    if (trendId) {
      await db.update(trends).set({ imagePath: imageUrl }).where(eq(trends.id, trendId));
    } else if (sessionId) {
      await db
        .update(sessions)
        .set({ backgroundImagePath: imageUrl })
        .where(eq(sessions.id, sessionId));
      broadcastToSession(sessionId, "backgroundUpdated", { imageUrl });
    }

    return Response.json({ imagePath: imageUrl });
  } catch (error) {
    console.error("Upload failed:", error);
    return Response.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

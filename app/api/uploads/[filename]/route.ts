import { readFile } from "fs/promises";
import path from "path";

const uploadsDir = path.join(process.cwd(), "data", "uploads");

const mimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Prevent path traversal
  if (filename.includes("..") || filename.includes("/")) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const filepath = path.join(uploadsDir, filename);
    const buffer = await readFile(filepath);

    // Determine mime type from extension
    const ext = filename.split(".").pop()?.toLowerCase() || "png";
    const mimeType = mimeTypes[ext] || "application/octet-stream";

    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return new Response("Not found", { status: 404 });
  }
}

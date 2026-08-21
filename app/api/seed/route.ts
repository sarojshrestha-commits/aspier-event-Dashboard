import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";

// Secret-gated admin seed/rotate endpoint for production deploys, where the
// unauthenticated /api/admin/init convenience route isn't appropriate.
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SEED_SECRET;

  if (!adminSecret || auth !== `Bearer ${adminSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const username = body.username || process.env.ADMIN_USERNAME || "admin";
  const password = body.password || process.env.ADMIN_PASSWORD;

  if (!password) {
    return Response.json(
      { error: "Password required (body.password or ADMIN_PASSWORD env var)" },
      { status: 400 }
    );
  }

  const passwordHash = hashPassword(password);

  const existing = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.username, username),
  });

  if (existing) {
    // Upsert — lets this endpoint double as credential rotation on redeploy,
    // not just first-boot seeding.
    await db
      .update(adminUsers)
      .set({ passwordHash })
      .where(eq(adminUsers.username, username));

    return Response.json({
      success: true,
      message: `Password updated for existing user ${username}`,
    });
  }

  await db.insert(adminUsers).values({ username, passwordHash });

  return Response.json({ success: true, message: `User ${username} created` });
}

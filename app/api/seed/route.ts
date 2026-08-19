import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SEED_SECRET;

  if (!adminSecret || auth !== `Bearer ${adminSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username, password } = await request.json();

  if (!username || !password) {
    return Response.json(
      { error: "Username and password required" },
      { status: 400 }
    );
  }

  // Check if user already exists
  const existing = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.username, username),
  });

  if (existing) {
    return Response.json({ error: "User already exists" }, { status: 400 });
  }

  const passwordHash = hashPassword(password);

  await db.insert(adminUsers).values({
    username,
    passwordHash,
  });

  return Response.json({ success: true, message: `User ${username} created` });
}

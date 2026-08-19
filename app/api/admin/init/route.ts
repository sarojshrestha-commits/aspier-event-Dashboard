import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  // Check if any admin user exists
  const existing = await db.query.adminUsers.findFirst();

  if (existing) {
    return Response.json(
      { message: "Admin user already exists" },
      { status: 200 }
    );
  }

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  const passwordHash = hashPassword(password);

  await db.insert(adminUsers).values({
    username,
    passwordHash,
  });

  return Response.json({
    message: `Created admin user: ${username}`,
    username,
    password: password === (process.env.ADMIN_PASSWORD || "admin123")
      ? "configured via ADMIN_PASSWORD"
      : "default (admin123)",
  });
}

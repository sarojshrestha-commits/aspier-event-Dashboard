import { verifyCredentials, createSession, setSessionCookie } from "@/lib/auth";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json(
        { error: "Username and password required" },
        { status: 400 }
      );
    }

    const isValid = await verifyCredentials(username, password);

    if (!isValid) {
      return Response.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await createSession(username);
    await setSessionCookie(token);

    return Response.json({ success: true, token });
  } catch (error) {
    console.error("Login error:", error);
    return Response.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}

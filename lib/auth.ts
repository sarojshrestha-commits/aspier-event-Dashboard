import { cookies } from "next/headers";
import crypto from "crypto-js";
import { db } from "./db";
import { adminUsers } from "./db/schema";
import { eq } from "drizzle-orm";

const SESSION_COOKIE_NAME = "aspier_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-in-production";

export function hashPassword(password: string): string {
  return crypto.SHA256(password + SESSION_SECRET).toString();
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const user = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.username, username),
  });

  if (!user) return false;

  const hash = hashPassword(password);
  return hash === user.passwordHash;
}

export function createSessionToken(username: string): string {
  const token = crypto
    .SHA256(username + Date.now() + Math.random())
    .toString()
    .slice(0, 32);
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// In-memory session storage for this demo (in production, use Redis or similar)
const sessions = new Map<string, { username: string; createdAt: number }>();

export async function isSessionValid(token: string): Promise<boolean> {
  const session = sessions.get(token);
  if (!session) return false;

  // Check if session is still valid (7 days)
  const age = Date.now() - session.createdAt;
  if (age > 7 * 24 * 60 * 60 * 1000) {
    sessions.delete(token);
    return false;
  }

  return true;
}

export async function getSessionUsername(token: string): Promise<string | null> {
  const session = sessions.get(token);
  return session?.username || null;
}

export async function createSession(username: string): Promise<string> {
  const token = createSessionToken(username);
  sessions.set(token, { username, createdAt: Date.now() });
  return token;
}

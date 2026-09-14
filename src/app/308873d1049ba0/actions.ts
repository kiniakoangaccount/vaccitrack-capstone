"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 8;

function getSessionSignature(payload: string): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function makeToken(username: string): string | null {
  const payload = Buffer.from(`${username}:${Date.now()}`).toString("base64url");
  const signature = getSessionSignature(payload);
  return signature ? `${payload}.${signature}` : null;
}

export async function adminLogin(formData: FormData): Promise<{ error: string } | never> {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const username = (formData.get("username") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!adminUsername || !adminPassword || !process.env.ADMIN_SESSION_SECRET || username !== adminUsername || password !== adminPassword) {
    return { error: "Invalid username or password." };
  }

  const token = makeToken(username);
  if (!token) return { error: "Administrator authentication is not configured." };

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/x7k2",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/x7k2/dashboard");
}

export async function adminLogout(): Promise<never> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/x7k2");
}

export async function getAdminSession(): Promise<{ username: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const [payload, signature] = token.split(".");
    const expectedSignature = getSessionSignature(payload);
    if (!payload || !signature || !expectedSignature) return null;
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
    const [username, tsStr] = Buffer.from(payload, "base64url").toString("utf8").split(":");
    const ts = Number(tsStr);
    const expired = Date.now() - ts > SESSION_MAX_AGE * 1000;
    if (!username || expired) return null;
    return { username };
  } catch {
    return null;
  }
}

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "Harimson";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Nosmirah";
const SESSION_COOKIE = "admin_session";
// 8-hour session
const SESSION_MAX_AGE = 60 * 60 * 8;

function makeToken(username: string): string {
  const payload = `${username}:${Date.now()}`;
  return Buffer.from(payload).toString("base64");
}

export async function adminLogin(formData: FormData): Promise<{ error: string } | never> {
  const username = (formData.get("username") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return { error: "Invalid username or password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, makeToken(username), {
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
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const [username, tsStr] = decoded.split(":");
    const ts = Number(tsStr);
    const expired = Date.now() - ts > SESSION_MAX_AGE * 1000;
    if (!username || expired) return null;
    return { username };
  } catch {
    return null;
  }
}

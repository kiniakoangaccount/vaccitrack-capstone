import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cookie-scoped Supabase client for use inside server actions / route handlers.
 * Respects the caller's session (RLS applies) — for privileged bypass use createAdminClient instead.
 */
export async function createAuthenticatedClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Cookie writes are not available in every server action context.
        }
      },
    },
  });
}

export async function getAuthenticatedUser() {
  const client = await createAuthenticatedClient();
  if (!client) return { user: null, client: null, error: "Service unavailable." };
  const { data, error } = await client.auth.getUser();
  return { user: data.user, client, error: error?.message };
}

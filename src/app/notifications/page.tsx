import { redirect } from "next/navigation";
import NotificationsInbox from "@/app/_components/notifications/NotificationsInbox";
import type { UserNotification } from "@/app/_features/workspace/workspace-types";
import { getAuthenticatedUser } from "@/lib/supabase-server";

export default async function NotificationsPage() {
  const { user, client } = await getAuthenticatedUser();
  if (!user || !client) redirect("/signin");

  const { data: profile } = await client.from("profiles").select("role, status").eq("id", user.id).maybeSingle();
  if (profile?.status !== "active") redirect("/signin");

  const { data, error } = await client.from("notifications")
    .select("id, title, message, type, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return <NotificationsInbox initialNotifications={(data ?? []) as UserNotification[]} userId={user.id} role={profile.role ?? "viewer"} loadError={error?.message} />;
}

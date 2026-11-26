import { createAdminClient } from "./supabase-admin";

type AdminDb = NonNullable<ReturnType<typeof createAdminClient>>;

export type InAppNotification = {
  user_id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "danger" | "success";
  dedupe_key: string;
};

export async function insertInAppNotification(
  db: AdminDb,
  notification: InAppNotification,
): Promise<{ error?: string }> {
  const { error } = await db.from("notifications").insert(notification);
  if (error?.code === "23505") return {};
  if (error) return { error: error.message };
  return {};
}

export async function insertInAppNotifications(
  db: AdminDb,
  notifications: InAppNotification[],
): Promise<string[]> {
  const errors: string[] = [];
  for (const notification of notifications) {
    const result = await insertInAppNotification(db, notification);
    if (result.error) errors.push(result.error);
  }
  return errors;
}

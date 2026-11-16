import { createAdminClient } from "@/lib/supabase-admin";

type AdminDb = NonNullable<ReturnType<typeof createAdminClient>>;

export type MessageHistoryDraft = {
  channel: "email" | "sms";
  message_type: "custom" | "test";
  recipient_name: string | null;
  recipient_address: string;
  subject: string | null;
  sent_by: string;
};

export async function startMessageHistory(
  db: AdminDb,
  messages: MessageHistoryDraft[],
): Promise<{ ids: number[] } | { error: string }> {
  const { data, error } = await db
    .from("message_history")
    .insert(messages.map((message) => ({ ...message, status: "sending" })))
    .select("id");

  if (error) {
    console.error("Could not create sent-message history:", error.message);
    return { error: "Could not record message recipients; nothing was sent." };
  }

  const rows = (data ?? []) as { id: number }[];
  if (rows.length !== messages.length) {
    console.error("Sent-message history returned an unexpected number of records.");
    return { error: "Could not confirm message history records; nothing was sent." };
  }

  return { ids: rows.map((row) => row.id) };
}

export async function completeMessageHistory(
  db: AdminDb,
  ids: number[],
  delivered: boolean[],
): Promise<boolean> {
  if (ids.length !== delivered.length) {
    console.error("Sent-message history result count did not match recipient count.");
    return false;
  }

  const sentIds = ids.filter((_, index) => delivered[index]);
  const failedIds = ids.filter((_, index) => !delivered[index]);
  const updates = await Promise.all([
    sentIds.length > 0
      ? db.from("message_history").update({ status: "sent", sent_at: new Date().toISOString() }).in("id", sentIds)
      : Promise.resolve({ error: null }),
    failedIds.length > 0
      ? db.from("message_history").update({ status: "failed" }).in("id", failedIds)
      : Promise.resolve({ error: null }),
  ]);
  const failedUpdate = updates.find((result) => result.error);
  if (failedUpdate?.error) {
    console.error("Could not update sent-message history:", failedUpdate.error.message);
    return false;
  }

  return true;
}

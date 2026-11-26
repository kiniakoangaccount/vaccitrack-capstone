"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { getAdminSession } from "@/app/vaccitrack_super_hidden_admin/actions";

const PAGE_SIZE = 20;
const MAX_PAGE = 1_000_000;

export type SentMessageRow = {
  id: number;
  channel: "sms";
  message_type: "custom" | "test";
  recipient_name: string | null;
  recipient_address: string;
  status: "sending" | "sent" | "failed";
  sent_by: string;
  created_at: string;
  sent_at: string | null;
};

export async function fetchSentMessagePage(pageInput: number): Promise<{
  rows: SentMessageRow[];
  total: number;
  page: number;
  error?: string;
}> {
  const page = Number.isSafeInteger(pageInput) && pageInput >= 1 && pageInput <= MAX_PAGE ? pageInput : 1;
  if (!(await getAdminSession())) {
    return { rows: [], total: 0, page, error: "Only the super-admin can view sent-message history." };
  }

  const db = createAdminClient();
  if (!db) return { rows: [], total: 0, page, error: "Service unavailable." };

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await db
    .from("message_history")
    .select("id, channel, message_type, recipient_name, recipient_address, status, sent_by, created_at, sent_at", { count: "exact" })
    .eq("channel", "sms")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    console.error("Could not load sent-message history:", error.message);
    return {
      rows: [],
      total: 0,
      page,
      error: "Sent-message history is unavailable. Apply the latest supabase/schema.sql, then retry.",
    };
  }

  return {
    rows: (data ?? []) as SentMessageRow[],
    total: count ?? 0,
    page,
  };
}

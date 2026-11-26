import type { UserNotification } from "@/app/_features/workspace/workspace-types";

export type NotificationTab = "Appointments" | "Planning" | "Registry" | "Feedback" | "Overview";

/** Picks the most useful workspace section for a notification. */
export function getNotificationTab(notification: Pick<UserNotification, "title" | "message" | "type">, role: string): NotificationTab {
  const text = `${notification.title} ${notification.message} ${notification.type}`.toLowerCase();
  const isStaff = role === "admin" || role === "bhw";

  if (/appointment|scheduled visit/.test(text)) return isStaff ? "Appointments" : "Registry";
  if (/vaccin|expir|due|reminder/.test(text)) return isStaff ? "Planning" : "Registry";
  if (/feedback/.test(text)) return "Feedback";
  return "Overview";
}

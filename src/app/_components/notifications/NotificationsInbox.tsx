"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, CheckCheck } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/app/_features/notifications/notification-actions";
import { getNotificationTab } from "@/app/_features/notifications/notification-navigation";
import type { UserNotification } from "@/app/_features/workspace/workspace-types";

type Props = { initialNotifications: UserNotification[]; userId: string; role: string; loadError?: string | null };

export default function NotificationsInbox({ initialNotifications, userId, role, loadError }: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);
  const visibleNotifications = filter === "unread" ? notifications.filter((item) => !item.is_read) : notifications;

  async function openNotification(notification: UserNotification) {
    if (!notification.is_read) {
      const result = await markNotificationRead(notification.id);
      if (!result.error) setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
    }
    router.push(`/?tab=${getNotificationTab(notification, role)}`);
  }

  async function markAllRead() {
    const result = await markAllNotificationsRead(userId);
    if (!result.error) setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
  }

  return (
    <main className="notifications-page">
      <div className="notifications-page-top"><button className="secondary-button" onClick={() => router.push("/")}><ArrowLeft size={16} /> Back to workspace</button></div>
      <section className="notifications-inbox panel">
        <div className="notifications-inbox-heading">
          <div><p className="eyebrow">YOUR ACCOUNT</p><h1>Notifications</h1><p className="heading-sub">Updates about vaccinations, appointments, and your workspace.</p></div>
          {unreadCount > 0 && <button className="text-button" onClick={() => void markAllRead()}><CheckCheck size={16} /> Mark all as read</button>}
        </div>
        <div className="notifications-inbox-filters" aria-label="Filter notifications">
          <button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>All <span>{notifications.length}</span></button>
          <button className={filter === "unread" ? "selected" : ""} onClick={() => setFilter("unread")}>Unread <span>{unreadCount}</span></button>
        </div>
        {loadError && <p className="notification-load-error">Could not load notifications: {loadError}</p>}
        {visibleNotifications.length === 0 ? <div className="notifications-inbox-empty"><Bell size={24} /><strong>{filter === "unread" ? "No unread notifications" : "No notifications yet"}</strong><p>New updates will appear here.</p></div> : (
          <div className="notifications-inbox-list">
            {visibleNotifications.map((notification) => <button className={`notifications-inbox-item ${notification.is_read ? "is-read" : "is-unread"}`} key={notification.id} onClick={() => void openNotification(notification)}>
              <span className={`notification-icon ${notification.type === "danger" ? "danger" : ""}`}><Bell size={16} /></span>
              <span className="notifications-inbox-copy"><strong>{notification.title}</strong><span>{notification.message}</span><small>{new Date(notification.created_at).toLocaleString()}</small></span>
              {!notification.is_read && <span className="notifications-unread-dot" aria-label="Unread" />}
            </button>)}
          </div>
        )}
      </section>
    </main>
  );
}

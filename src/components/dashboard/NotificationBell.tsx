"use client";

import { useState, useEffect, useRef } from "react";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  createdAt: string;
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function typeColor(type: string) {
  if (type === "SUCCESS") return "bg-emerald-500";
  if (type === "WARNING") return "bg-amber-500";
  if (type === "ERROR") return "bg-red-500";
  return "bg-[#5B4FE9]";
}

async function loadNotifications() {
  const res = await fetch("/api/notifications");
  return res.json();
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [clearing, setClearing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function refresh() {
    loadNotifications()
      .then((data) => {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      })
      .catch(() => {});
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function clearAll() {
    setClearing(true);
    try {
      await fetch("/api/notifications", { method: "DELETE" });
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      // silent
    } finally {
      setClearing(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-[#EBEBF0] text-[#555570] hover:bg-[#F5F5F7] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white border border-[#EBEBF0] rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#EBEBF0]">
            <p className="text-[13px] font-semibold text-[#1A1A2E]">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full">
                  {unreadCount} new
                </span>
              )}
            </p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-[#5B4FE9] font-medium hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-[13px] text-[#9999AA]">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`flex gap-3 px-4 py-3 border-b border-[#F5F5F7] cursor-pointer hover:bg-[#F5F5F7] transition-colors ${
                    !n.read ? "bg-[#F8F8FF]" : ""
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${typeColor(n.type)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#1A1A2E]">{n.title}</p>
                    <p className="text-[11px] text-[#9999AA] mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-[#BBBBCC] mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer — clear history */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[#EBEBF0] flex justify-end">
              <button
                onClick={clearAll}
                disabled={clearing}
                className="flex items-center gap-1.5 text-[11px] text-[#9999AA] hover:text-red-500 transition-colors disabled:opacity-50"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                {clearing ? "Clearing…" : "Clear history"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
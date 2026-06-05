import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

interface Notification {
  _id: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  async function load(uid: string) {
    const notifications = await apiFetch<Notification[]>(`/api/notifications?userId=${encodeURIComponent(uid)}`);
    setItems(notifications ?? []);
  }

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) return;
      setUserId(user._id);
      await load(user._id);
    })();
  }, []);

  const unread = items.filter((n) => !n.read).length;

  async function markAllRead() {
    if (!userId) return;
    await apiFetch(`/api/notifications?userId=${encodeURIComponent(userId)}`, {
      method: "PUT",
    });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function open(notification: Notification) {
    if (!notification.read) {
      await apiFetch(`/api/notifications/${encodeURIComponent(notification._id)}`, {
        method: "PUT",
        body: JSON.stringify({ read: true }),
      });
      setItems((prev) => prev.map((x) => x._id === notification._id ? { ...x, read: true } : x));
    }
    if (notification.link) {
      navigate({ to: notification.link });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card transition hover:bg-accent"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="font-semibold text-sm">Notifications</div>
          {unread > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet</div>
          ) : (
            items.map((n) => (
              <button
                key={n._id}
                onClick={() => open(n)}
                className={`block w-full border-b border-border p-3 text-left text-sm transition hover:bg-accent ${!n.read ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <div className="flex-1">
                    <div className="font-medium">{n.title}</div>
                    {n.message && <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>}
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

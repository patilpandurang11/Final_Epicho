"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck } from "lucide-react";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  const load = () => {
    if (!user) return;
    apiRequest("/notifications")
      .then((res) => {
        setNotifications(res.notifications || []);
        setUnread(res.unread_count || 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, [user]);

  const markRead = async (id: string) => {
    await apiRequest(`/notifications/${id}/read`, { method: "PATCH" });
    load();
  };

  const markAllRead = async () => {
    await apiRequest("/notifications/read-all", { method: "POST" });
    load();
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
        <Bell className="w-10 h-10 mx-auto text-[#EA580C]" />
        <h1 className="text-2xl font-bold">Sign in to view notifications</h1>
        <Link href="/login"><Button>Log In</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="w-7 h-7 text-[#EA580C]" /> Notifications
          </h1>
          <p className="text-xs text-[#475569]">{unread} unread alerts</p>
        </div>
        <Button onClick={markAllRead} variant="outline" size="sm">
          <CheckCheck className="w-4 h-4" /> Mark All Read
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-sm text-[#475569]">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.notification_id}
                className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                  n.is_read
                    ? "border-[#E7DFD3] dark:border-[#253D31]"
                    : "border-[#059669] bg-emerald-50/40 dark:bg-emerald-950/30"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={n.is_read ? "outline" : "emerald"}>{n.type}</Badge>
                    <span className="font-bold text-sm">{n.title}</span>
                  </div>
                  <p className="text-xs text-[#475569] dark:text-[#A7B8AE]">{n.body}</p>
                  {n.action_url && (
                    <Link href={n.action_url} className="text-xs font-bold text-[#9A3412] hover:underline">
                      Open
                    </Link>
                  )}
                </div>
                {!n.is_read && (
                  <Button onClick={() => markRead(n.notification_id)} size="sm" variant="ghost">
                    Mark read
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

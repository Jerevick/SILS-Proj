"use client";

/**
 * Phase 21: User notification center (in-app inbox).
 * Filters: all / unread / read; mark as read; mark all as read.
 * TanStack Query for real-time updates.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  Mail,
  MessageSquare,
  Smartphone,
  Filter,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  type NotificationItem,
} from "@/app/actions/notification-actions";
import { useMe } from "@/hooks/use-me";

type FilterType = "all" | "unread" | "read";

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  EMAIL: Mail,
  SMS: MessageSquare,
  PUSH: Smartphone,
  IN_APP: Bell,
  WHATSAPP: MessageSquare,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<FilterType>("all");
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const isAdmin = me?.kind === "tenant" && (me.role === "OWNER" || me.role === "ADMIN");

  const { data: listData, isLoading, error } = useQuery({
    queryKey: ["notifications", filter],
    queryFn: async () => {
      const r = await listNotifications({
        filter: filter === "all" ? undefined : filter,
        limit: 50,
      });
      if (!r.ok) throw new Error(r.error);
      return r;
    },
  });

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unreadCount"],
    queryFn: async () => {
      const r = await getUnreadCount();
      if (!r.ok) return { count: 0 };
      return r;
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const items = listData?.items ?? [];
  const unreadCount = unreadData?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">
          Notifications
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as FilterType)}
          >
            <SelectTrigger className="w-[140px] border-white/20 bg-space-800 text-slate-200">
              <Filter className="h-4 w-4 text-slate-400 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 text-slate-300"
            onClick={() => markAllReadMutation.mutate()}
            disabled={unreadCount === 0 || markAllReadMutation.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            Mark all read
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400"
            asChild
          >
            <Link href="/notifications/settings">
              <Settings className="h-4 w-4 mr-1" />
              Settings
            </Link>
          </Button>
          {isAdmin && (
            <Button variant="ghost" size="sm" className="text-slate-400" asChild>
              <Link href="/notifications/templates">
                Templates
              </Link>
            </Button>
          )}
        </div>
      </div>

      {isLoading && (
        <p className="text-slate-400">Loading notifications…</p>
      )}
      {error && (
        <p className="text-amber-400">
          {error instanceof Error ? error.message : "Failed to load notifications."}
        </p>
      )}

      {!isLoading && !error && items.length === 0 && (
        <Card className="border-white/10 bg-space-800/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-slate-500 mb-3" />
            <p className="text-slate-400">
              {filter === "unread"
                ? "No unread notifications."
                : filter === "read"
                  ? "No read notifications."
                  : "No notifications yet."}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((n) => (
            <NotificationCard
              key={n.id}
              item={n}
              onMarkRead={() => markReadMutation.mutate(n.id)}
              isMarkingRead={markReadMutation.isPending && markReadMutation.variables === n.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationCard({
  item,
  onMarkRead,
  isMarkingRead,
}: {
  item: NotificationItem;
  onMarkRead: () => void;
  isMarkingRead: boolean;
}) {
  const Icon = CHANNEL_ICONS[item.channel] ?? Bell;
  const isUnread = !item.readAt;

  return (
    <Card
      className={
        "border-white/10 bg-space-800/50 transition-colors " +
        (isUnread ? "ring-1 ring-neon-cyan/20" : "")
      }
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 rounded-lg bg-white/5 p-2 text-slate-400">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base font-semibold text-white">
                {item.title}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {item.channel.replace("_", " ")} · {formatDate(item.createdAt)}
              </p>
            </div>
          </div>
          {isUnread && item.channel === "IN_APP" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-neon-cyan shrink-0"
              onClick={onMarkRead}
              disabled={isMarkingRead}
            >
              Mark read
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-slate-300 whitespace-pre-wrap text-sm">{item.body}</p>
      </CardContent>
    </Card>
  );
}

"use client";

/**
 * Phase 21: Notification settings — per-channel preferences (email, SMS, push, in-app, WhatsApp).
 * Toggles stored per user per tenant.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Mail, MessageSquare, Bell, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreferenceItem,
} from "@/app/actions/notification-actions";
import type { NotificationChannel } from "@prisma/client";

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  PUSH: "Push (browser/device)",
  IN_APP: "In-app inbox",
  WHATSAPP: "WhatsApp",
};

const CHANNEL_ICONS: Record<NotificationChannel, React.ComponentType<{ className?: string }>> = {
  EMAIL: Mail,
  SMS: MessageSquare,
  PUSH: Smartphone,
  IN_APP: Bell,
  WHATSAPP: MessageSquare,
};

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const r = await getNotificationPreferences();
      if (!r.ok) throw new Error(r.error);
      return r.preferences;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ channel, enabled }: { channel: NotificationChannel; enabled: boolean }) =>
      updateNotificationPreference({ channel, enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleToggle = (item: NotificationPreferenceItem) => {
    updateMutation.mutate({ channel: item.channel, enabled: !item.enabled });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" className="text-slate-400" asChild>
          <Link href="/notifications">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to notifications
          </Link>
        </Button>
      </div>
      <h1 className="font-display text-2xl font-bold text-white tracking-tight">
        Notification settings
      </h1>
      <p className="text-slate-400 text-sm">
        Choose which channels you want to receive notifications on. In-app notifications always appear in your inbox.
      </p>

      {isLoading && <p className="text-slate-400">Loading preferences…</p>}
      {error && (
        <p className="text-amber-400">
          {error instanceof Error ? error.message : "Failed to load preferences."}
        </p>
      )}

      {data && (
        <Card className="border-white/10 bg-space-800/50">
          <CardHeader>
            <CardTitle className="text-lg text-white">Channels</CardTitle>
            <p className="text-sm text-slate-500">
              Enable or disable each channel. Disabled channels will not receive new notifications.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.map((item) => {
              const Icon = CHANNEL_ICONS[item.channel];
              return (
                <div
                  key={item.channel}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-space-900/50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-white/5 p-2 text-slate-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {CHANNEL_LABELS[item.channel]}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.channel === "IN_APP"
                          ? "Notifications appear in your notification center."
                          : `Receive notifications via ${item.channel.toLowerCase()}.`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.enabled}
                    onClick={() => handleToggle(item)}
                    disabled={updateMutation.isPending}
                    className={
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-neon-cyan/40 " +
                      (item.enabled ? "bg-neon-cyan" : "bg-white/20")
                    }
                  >
                    <span
                      className={
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition " +
                        (item.enabled ? "translate-x-5" : "translate-x-1")
                      }
                    />
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

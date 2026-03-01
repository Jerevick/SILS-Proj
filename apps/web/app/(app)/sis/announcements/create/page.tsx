"use client";

/**
 * Institution-scoped: Create new announcement with scope picker.
 * Scope: All, School, Department, Programme, Module, Role.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Megaphone, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  sendAnnouncement,
  getAnnouncementScopeOptions,
  type SendAnnouncementInput,
  type AnnouncementScopeOption,
} from "@/app/actions/announcement-actions";
import type { AnnouncementScopeType } from "@prisma/client";
import { toast } from "sonner";

const SCOPE_TYPE_LABELS: Record<AnnouncementScopeType, string> = {
  ALL: "All (entire institution)",
  SCHOOL: "School",
  DEPARTMENT: "Department",
  PROGRAMME: "Programme",
  MODULE: "Programme module",
  ROLE: "Role",
};

export default function SisCreateAnnouncementPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetScopeType, setTargetScopeType] = useState<AnnouncementScopeType>("ALL");
  const [targetScopeId, setTargetScopeId] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: scopeData, isLoading: loadingScope } = useQuery({
    queryKey: ["announcement-scope-options"],
    queryFn: async () => {
      const r = await getAnnouncementScopeOptions();
      if (!r.ok) throw new Error(r.error);
      return r.options;
    },
  });

  const filteredOptions: AnnouncementScopeOption[] = scopeData?.filter((o) => o.type === targetScopeType) ?? [];

  const sendMutation = useMutation({
    mutationFn: (input: SendAnnouncementInput) => sendAnnouncement(input),
    onSuccess: (r) => {
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: ["announcements"] });
        toast.success(`Announcement sent to ${r.recipientCount} recipient(s).`);
        setTitle("");
        setBody("");
        setTargetScopeId("");
        setScheduledAt("");
        setExpiresAt("");
      } else {
        toast.error(r.error);
      }
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to send announcement.");
    },
  });

  useEffect(() => {
    setTargetScopeId("");
  }, [targetScopeType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required.");
      return;
    }
    if (targetScopeType !== "ALL" && filteredOptions.length > 0 && !targetScopeId) {
      toast.error("Please select a scope.");
      return;
    }
    sendMutation.mutate({
      title: title.trim(),
      body: body.trim(),
      targetScopeType,
      targetScopeId: targetScopeType === "ALL" ? null : (targetScopeId || null),
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });
  };

  return (
    <div className="min-h-screen bg-grid-pattern bg-space-950">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/sis/dashboard" className="text-slate-400 hover:text-white flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-white tracking-tight">Create announcement</h1>
        <p className="text-slate-400 mt-1">
          Send a scoped announcement. Recipients are resolved from the selected scope (school, department, programme, module, or role).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="rounded-xl border border-white/10 bg-space-800/50 p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title"
              className="border-white/20 bg-transparent text-slate-200"
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Body</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Full announcement text…"
              rows={6}
              className="border-white/20 bg-transparent text-slate-200 resize-y"
              required
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-space-800/50 p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-neon-cyan" />
            Target scope
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Scope type</Label>
              <Select value={targetScopeType} onValueChange={(v) => setTargetScopeType(v as AnnouncementScopeType)}>
                <SelectTrigger className="border-white/20 bg-transparent text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(SCOPE_TYPE_LABELS) as [AnnouncementScopeType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {targetScopeType !== "ALL" && (
              <div className="space-y-2">
                <Label className="text-slate-300">{SCOPE_TYPE_LABELS[targetScopeType]}</Label>
                <Select value={targetScopeId} onValueChange={setTargetScopeId} disabled={loadingScope || filteredOptions.length === 0}>
                  <SelectTrigger className="border-white/20 bg-transparent text-slate-200">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!loadingScope && filteredOptions.length === 0 && targetScopeType !== "ALL" && (
                  <p className="text-xs text-slate-500">No options in this scope.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-space-800/50 p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-white">Schedule (optional)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Scheduled at</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="border-white/20 bg-transparent text-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Expires at</Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="border-white/20 bg-transparent text-slate-200"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={sendMutation.isPending || !title.trim() || !body.trim()}
            className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
          >
            {sendMutation.isPending ? "Sending…" : "Send announcement"}
          </Button>
          <Link href="/sis/dashboard">
            <Button type="button" variant="ghost" className="text-slate-300 hover:text-white">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

"use client";

/**
 * Phase 21: Notification template manager (tenant admin).
 * Create/edit templates with variable placeholders (e.g. {{studentName}}, {{courseTitle}}).
 * Scoped to current tenant; OWNER/ADMIN only.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  type TemplateItem,
  type CreateTemplateInput,
} from "@/app/actions/notification-actions";
import type { NotificationChannel } from "@prisma/client";

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "PUSH", label: "Push" },
  { value: "IN_APP", label: "In-app" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

export default function NotificationTemplatesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["notification-templates"],
    queryFn: async () => {
      const r = await listNotificationTemplates();
      if (!r.ok) throw new Error(r.error);
      return r.templates;
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTemplateInput) => createNotificationTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      setCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; name?: string; subject?: string | null; bodyTemplate?: string; variables?: unknown }) =>
      updateNotificationTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      setEditId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotificationTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      setEditId(null);
    },
  });

  const templates = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" className="text-slate-400" asChild>
          <Link href="/notifications">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to notifications
          </Link>
        </Button>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-neon-cyan text-space-950 hover:bg-neon-cyan/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          New template
        </Button>
      </div>

      <h1 className="font-display text-2xl font-bold text-white tracking-tight">
        Notification templates
      </h1>
      <p className="text-slate-400 text-sm">
        Create and edit templates for each channel. Use {"{{variableName}}"} in subject and body for dynamic content.
      </p>

      {isLoading && <p className="text-slate-400">Loading templates…</p>}
      {error && (
        <p className="text-amber-400">
          {error instanceof Error ? error.message : "Failed to load templates."}
        </p>
      )}

      {!isLoading && templates.length === 0 && (
        <Card className="border-white/10 bg-space-800/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-slate-500 mb-3" />
            <p className="text-slate-400 mb-4">No templates yet. Create one to get started.</p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-neon-cyan text-space-950 hover:bg-neon-cyan/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              New template
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && templates.length > 0 && (
        <div className="space-y-3">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => setEditId(t.id)}
              onDelete={() => deleteMutation.mutate(t.id)}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === t.id}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <TemplateFormModal
          title="New template"
          submitLabel="Create"
          onClose={() => setCreateOpen(false)}
          onSubmit={(input) => createMutation.mutate(input)}
          isSubmitting={createMutation.isPending}
        />
      )}

      {editId && (
        <TemplateEditModal
          templateId={editId}
          template={templates.find((t) => t.id === editId) ?? null}
          onClose={() => setEditId(null)}
          onSave={(updates) => updateMutation.mutate({ id: editId, ...updates })}
          isSaving={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
  isDeleting,
}: {
  template: TemplateItem;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const channelLabel = CHANNEL_OPTIONS.find((c) => c.value === template.channel)?.label ?? template.channel;
  return (
    <Card className="border-white/10 bg-space-800/50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold text-white">
              {template.name}
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">{channelLabel}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" className="text-slate-400" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300"
              onClick={onDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {template.subject && (
          <p className="text-sm text-slate-400 mb-1">
            <span className="text-slate-500">Subject:</span> {template.subject}
          </p>
        )}
        <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-2">
          {template.bodyTemplate}
        </p>
      </CardContent>
    </Card>
  );
}

function TemplateFormModal({
  title,
  submitLabel,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (input: CreateTemplateInput) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<NotificationChannel>("IN_APP");
  const [subject, setSubject] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [variablesJson, setVariablesJson] = useState("[]");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let variables: unknown = undefined;
    try {
      variables = JSON.parse(variablesJson || "[]");
    } catch {
      // leave undefined if invalid
    }
    onSubmit({
      name: name.trim(),
      channel,
      subject: subject.trim() || null,
      bodyTemplate: bodyTemplate.trim(),
      variables,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg border-white/10 bg-space-900 text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-slate-400">Template name (e.g. grade_posted)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="grade_posted"
              className="mt-1 border-white/20 bg-space-800 text-white"
              required
            />
          </div>
          <div>
            <Label htmlFor="channel" className="text-slate-400">Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as NotificationChannel)}>
              <SelectTrigger id="channel" className="mt-1 border-white/20 bg-space-800 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="subject" className="text-slate-400">Subject (email only)</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your grade for {{assignmentTitle}}"
              className="mt-1 border-white/20 bg-space-800 text-white"
            />
          </div>
          <div>
            <Label htmlFor="body" className="text-slate-400">Body template (use {"{{variableName}}"} for placeholders)</Label>
            <textarea
              id="body"
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              placeholder="Hi {{studentName}}, your grade for {{assignmentTitle}} is {{grade}}."
              rows={4}
              className="mt-1 w-full rounded-md border border-white/20 bg-space-800 px-3 py-2 text-white placeholder-slate-500 focus:border-neon-cyan/40 focus:outline-none"
              required
            />
          </div>
          <div>
            <Label htmlFor="variables" className="text-slate-400">Variables (JSON array, optional)</Label>
            <Input
              id="variables"
              value={variablesJson}
              onChange={(e) => setVariablesJson(e.target.value)}
              placeholder='[{"key":"studentName","label":"Student name"}]'
              className="mt-1 border-white/20 bg-space-800 text-white font-mono text-sm"
            />
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="border-white/20">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-neon-cyan text-space-950">
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TemplateEditModal({
  templateId,
  template,
  onClose,
  onSave,
  isSaving,
}: {
  templateId: string;
  template: TemplateItem | null;
  onClose: () => void;
  onSave: (updates: { name?: string; subject?: string | null; bodyTemplate?: string; variables?: unknown }) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [bodyTemplate, setBodyTemplate] = useState(template?.bodyTemplate ?? "");
  const [variablesJson, setVariablesJson] = useState(
    template?.variables ? JSON.stringify(template.variables, null, 2) : "[]"
  );

  if (!template) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let variables: unknown = undefined;
    try {
      variables = JSON.parse(variablesJson || "[]");
    } catch {
      // leave undefined
    }
    onSave({
      name: name.trim(),
      subject: subject.trim() || null,
      bodyTemplate: bodyTemplate.trim(),
      variables,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg border-white/10 bg-space-900 text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-white">Edit template</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name" className="text-slate-400">Template name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 border-white/20 bg-space-800 text-white"
              required
            />
          </div>
          <p className="text-xs text-slate-500">Channel: {template.channel}</p>
          <div>
            <Label htmlFor="edit-subject" className="text-slate-400">Subject</Label>
            <Input
              id="edit-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 border-white/20 bg-space-800 text-white"
            />
          </div>
          <div>
            <Label htmlFor="edit-body" className="text-slate-400">Body template</Label>
            <textarea
              id="edit-body"
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-white/20 bg-space-800 px-3 py-2 text-white focus:border-neon-cyan/40 focus:outline-none"
              required
            />
          </div>
          <div>
            <Label htmlFor="edit-variables" className="text-slate-400">Variables (JSON)</Label>
            <Input
              id="edit-variables"
              value={variablesJson}
              onChange={(e) => setVariablesJson(e.target.value)}
              className="mt-1 border-white/20 bg-space-800 text-white font-mono text-sm"
            />
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="border-white/20">
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-neon-cyan text-space-950">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

/**
 * Phase 26: Detailed alumni profile with "Connect as Mentor" button.
 * Scoped: Career Services, Alumni Relations, OWNER, ADMIN, LEARNER.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Building2, GraduationCap, Linkedin, MessageCircle } from "lucide-react";
import { useMe } from "@/hooks/use-me";
import { canAccessAlumni } from "@/lib/alumni-career-auth";

type AlumniDetail = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  graduationYear: number;
  degree: string;
  currentEmployer: string | null;
  currentRole: string | null;
  linkedinUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

async function fetchAlumniProfile(id: string): Promise<AlumniDetail> {
  const res = await fetch(`/api/alumni/${id}`);
  if (!res.ok) throw new Error("Failed to fetch alumni profile");
  return res.json();
}

export default function AlumniProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const { data: profile, isLoading } = useQuery({
    queryKey: ["alumni", id],
    queryFn: () => fetchAlumniProfile(id),
    enabled: !!id,
  });
  const { data: me } = useMe();
  const canAccess = me?.kind === "tenant" && canAccessAlumni(me.role);
  const [connectSent, setConnectSent] = React.useState(false);

  const handleConnectAsMentor = () => {
    setConnectSent(true);
    // In a full implementation this would create an AlumniMentorship request or open a modal/form.
    // For now we just show feedback; backend action for creating mentorship request can be added.
  };

  if (!canAccess) {
    return (
      <div className="p-6">
        <p className="text-slate-400">You do not have permission to view alumni profiles.</p>
      </div>
    );
  }

  if (isLoading || !profile) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Link
        href="/alumni"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-neon-cyan mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to alumni directory
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-slate-700 p-4">
            <User className="w-10 h-10 text-slate-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-white">{profile.name}</h1>
            {profile.email && (
              <p className="text-slate-400 text-sm mt-0.5">{profile.email}</p>
            )}
            <div className="flex flex-wrap gap-3 mt-3 text-slate-400 text-sm">
              <span className="inline-flex items-center gap-1">
                <GraduationCap className="w-4 h-4" />
                Class of {profile.graduationYear} · {profile.degree}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleConnectAsMentor}
          disabled={connectSent}
          className="inline-flex items-center gap-2 rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 disabled:opacity-70"
        >
          <MessageCircle className="w-4 h-4" />
          {connectSent ? "Request sent" : "Connect as Mentor"}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-6">
        <div>
          <h2 className="text-sm font-medium text-slate-400 mb-2">Current role</h2>
          <p className="text-white">
            {profile.currentRole ?? "—"}
            {profile.currentEmployer && (
              <span className="text-slate-400"> at {profile.currentEmployer}</span>
            )}
          </p>
        </div>
        {profile.currentEmployer && (
          <div className="flex items-center gap-2 text-slate-400">
            <Building2 className="w-4 h-4" />
            <span>{profile.currentEmployer}</span>
          </div>
        )}
        {profile.linkedinUrl && (
          <a
            href={profile.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-neon-cyan hover:underline"
          >
            <Linkedin className="w-4 h-4" />
            LinkedIn profile
          </a>
        )}
      </div>

      <p className="text-slate-500 text-xs mt-6">
        Profile created {new Date(profile.createdAt).toLocaleDateString()}. Connect as mentor to request career guidance.
      </p>
    </div>
  );
}

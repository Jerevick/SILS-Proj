"use client";

/**
 * tldraw embed for SILS whiteboard. Optional dependency; app works without it.
 * Load with dynamic import to avoid build errors when tldraw is not installed.
 */

import { useEffect, useState } from "react";

type TldrawEmbedProps = {
  snapshot?: string;
  onSave?: (snapshot: string) => void;
};

export function TldrawEmbed({ snapshot, onSave }: TldrawEmbedProps) {
  const [Tldraw, setTldraw] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([import("tldraw"), import("tldraw/tldraw.css")])
      .then(([mod]) => {
        if (!cancelled) setTldraw(() => mod.Tldraw as React.ComponentType<Record<string, unknown>>);
      })
      .catch(() => setTldraw(null));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !Tldraw) {
    return (
      <div className="flex-1 flex items-center justify-center rounded-xl border border-white/10 m-4 min-h-[400px]">
        <p className="text-slate-400">Loading whiteboard…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-[400px] rounded-xl overflow-hidden border border-white/10 tldraw-dark">
      <Tldraw persistenceKey="sils-whiteboard" />
    </div>
  );
}

"use client";

/**
 * Global "Enable low-bandwidth mode" toggle. Calls upsertStudentPreference; used in dashboard shell and content pages.
 */

import { useState, useEffect } from "react";
import { Wifi } from "lucide-react";
import { getMyPreference, upsertStudentPreference } from "@/app/actions/student-success";

export function LowBandwidthToggle() {
  const [on, setOn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyPreference().then((res) => {
      if (res.ok) setOn(res.preference.lowBandwidthMode);
      setLoading(false);
    });
  }, []);

  const handleToggle = () => {
    const next = !on;
    setOn(next);
    upsertStudentPreference({ lowBandwidthMode: next }).then((r) => {
      if (!r.ok) setOn(!next);
    });
  };

  if (loading) return null;

  return (
    <label className="flex items-center gap-2 cursor-pointer py-1.5 text-xs text-slate-500 hover:text-slate-400">
      <input
        type="checkbox"
        checked={on}
        onChange={handleToggle}
        className="rounded border-white/20 bg-white/5 text-neon-cyan focus:ring-neon-cyan/50"
      />
      <Wifi className="w-3.5 h-3.5" />
      <span>Low-bandwidth mode</span>
    </label>
  );
}

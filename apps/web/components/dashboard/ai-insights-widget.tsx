"use client";

/**
 * AI Insights widget for dashboards. Placeholder content; can be wired to AI later.
 */

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export interface AIInsightsWidgetProps {
  /** Dashboard context for contextual tips */
  context: string;
  /** Optional custom insights; otherwise uses default placeholder */
  insights?: { title: string; body: string }[];
}

const DEFAULT_INSIGHTS: Record<string, { title: string; body: string }[]> = {
  sis: [
    { title: "Enrollment trend", body: "Enrollment is steady this term. Consider opening waitlists for popular courses." },
    { title: "At-risk students", body: "AI can flag students who may need academic support based on engagement and grades." },
  ],
  admissions: [
    { title: "Application volume", body: "Applications are up 12% vs last cycle. Review queue may need extra capacity." },
    { title: "Yield prediction", body: "Predicted yield for early admits is strong; consider early financial aid offers." },
  ],
  finance: [
    { title: "Outstanding balances", body: "15% of students have balances due. Automated reminders can improve collection." },
    { title: "Aid utilization", body: "Financial aid utilization is on track. No action needed this week." },
  ],
  hr: [
    { title: "Faculty workload", body: "Two departments are above average teaching load. Consider adjunct support." },
    { title: "Leave patterns", body: "Leave requests are within normal range for this time of year." },
  ],
  advancement: [
    { title: "Donor engagement", body: "Use AI outreach to personalize messages for top donors. Focus on those with high affinity and no recent contact." },
    { title: "Campaign performance", body: "Active campaigns can be optimized with targeted follow-ups. Run the CRM agent per campaign for recommendations." },
  ],
  school: [
    { title: "Program performance", body: "All programs are meeting retention targets. Focus on placement next." },
    { title: "Capacity", body: "Seat utilization is healthy. No immediate capacity alerts." },
  ],
  department: [
    { title: "Course demand", body: "Three courses are at capacity. Consider adding sections or waitlist." },
    { title: "Grading pace", body: "Most grades are submitted on time. One course has pending submissions." },
  ],
  faculty: [
    { title: "Student engagement", body: "Discussion participation is up in your recent modules. Keep the format." },
    { title: "Assignment load", body: "Upcoming due dates are well spread. No clustering this week." },
  ],
  student: [
    { title: "Progress", body: "You're on track in all enrolled courses. Next milestone: midterm in 2 weeks." },
    { title: "Recommendations", body: "Based on your interests, consider enrolling in the Data Science elective." },
  ],
};

export function AIInsightsWidget({ context, insights }: AIInsightsWidgetProps) {
  const list = insights ?? DEFAULT_INSIGHTS[context] ?? DEFAULT_INSIGHTS.sis;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-xl glass border border-neon-cyan/20 bg-neon-cyan/5 overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <Sparkles className="h-4 w-4 text-neon-cyan" />
        <h2 className="font-display text-sm font-semibold text-white">
          AI Insights
        </h2>
      </div>
      <ul className="divide-y divide-white/5">
        {list.map((insight, i) => (
          <li
            key={i}
            className="px-4 py-3 hover:bg-white/[0.03] transition-colors"
          >
            <p className="text-sm font-medium text-white">{insight.title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{insight.body}</p>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

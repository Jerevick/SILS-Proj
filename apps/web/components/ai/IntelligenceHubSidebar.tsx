"use client";

/**
 * Reusable floating AI help button + global chat trigger for dashboard pages.
 * Framer Motion for entrance and hover. Appears on all dashboard pages; links to /ai/orchestrator or slide-over chat.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, MessageSquare, X } from "lucide-react";

type IntelligenceHubSidebarProps = {
  /** When true, hide the floating button (e.g. when tenant aiEnabled is false). */
  hidden?: boolean;
  /** Optional: show as slide-over chat instead of linking to /ai/orchestrator. */
  variant?: "link" | "slideover";
};

export function IntelligenceHubSidebar({ hidden = false, variant = "link" }: IntelligenceHubSidebarProps) {
  const pathname = usePathname();
  const [slideOpen, setSlideOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  if (hidden) return null;
  if (pathname === "/ai/orchestrator") return null;

  const sendChat = async () => {
    const text = chatMessage.trim();
    if (!text) return;
    setChatMessage("");
    setChatHistory((prev) => [...prev, { role: "user", content: text }]);
    setChatLoading(true);
    try {
      const { fetchGlobalChat } = await import("@/hooks/use-ai-orchestrator");
      const result = await fetchGlobalChat(text, [
        ...chatHistory,
        { role: "user", content: text },
      ]);
      if (result.ok) {
        setChatHistory((prev) => [...prev, { role: "assistant", content: result.text }]);
      } else {
        setChatHistory((prev) => [...prev, { role: "assistant", content: `Error: ${result.error}` }]);
      }
    } finally {
      setChatLoading(false);
    }
  };

  if (variant === "slideover") {
    return (
      <>
        <motion.button
          type="button"
          onClick={() => setSlideOpen(true)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan shadow-lg hover:bg-neon-cyan/30 transition-colors"
          title="Open AI Assistant"
          aria-label="Open AI Assistant"
        >
          <MessageSquare className="w-7 h-7" />
        </motion.button>
        <AnimatePresence>
          {slideOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex justify-end"
              >
                <div
                  className="absolute inset-0 bg-black/50"
                  onClick={() => setSlideOpen(false)}
                  aria-hidden
                />
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "tween", duration: 0.2 }}
                  className="relative w-full max-w-md bg-space-950 border-l border-white/10 shadow-xl flex flex-col"
                >
                  <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
                      <Brain className="w-5 h-5 text-neon-cyan" />
                      AI Assistant
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSlideOpen(false)}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                      aria-label="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
                    {chatHistory.length === 0 && (
                      <p className="text-slate-500 text-sm">Ask anything about your courses, students, or insights.</p>
                    )}
                    {chatHistory.map((m, i) => (
                      <div
                        key={i}
                        className={`rounded-lg px-3 py-2 text-sm ${
                          m.role === "user"
                            ? "bg-neon-cyan/20 text-neon-cyan ml-6"
                            : "bg-white/10 text-slate-200 mr-6"
                        }`}
                      >
                        {m.content}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="rounded-lg bg-white/10 text-slate-400 px-3 py-2 text-sm mr-6">Thinking…</div>
                    )}
                  </div>
                  <div className="p-3 border-t border-white/10 flex gap-2">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendChat()}
                      placeholder="Ask a question…"
                      className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50"
                    />
                    <button
                      type="button"
                      onClick={sendChat}
                      disabled={chatLoading || !chatMessage.trim()}
                      className="rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                  <div className="p-2 border-t border-white/5">
                    <Link
                      href="/ai/orchestrator"
                      className="text-xs text-slate-500 hover:text-neon-cyan block text-center"
                    >
                      Open full Intelligence Hub →
                    </Link>
                  </div>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link
        href="/ai/orchestrator"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan shadow-lg hover:bg-neon-cyan/30 transition-colors"
        title="Open SILS Intelligence Hub"
        aria-label="Open AI Assistant"
      >
        <Brain className="w-7 h-7" />
      </Link>
    </motion.div>
  );
}

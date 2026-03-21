"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp,
  BookmarkPlus,
  Trash2,
  Cloud,
  Globe,
  Calendar,
  MessageSquare,
  FolderSearch,
  Plane,
} from "lucide-react";
import type { ToolStatus } from "@/hooks/useVoiceAssistant";

const TOOLS: { name: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { name: "save_memory",          label: "Save Memory",   icon: BookmarkPlus  },
  { name: "delete_memory",        label: "Delete Memory", icon: Trash2        },
  { name: "get_weather",          label: "Weather",       icon: Cloud         },
  { name: "web_search",           label: "Web Search",    icon: Globe         },
  { name: "get_calendar_events",  label: "Calendar",      icon: Calendar      },
  { name: "send_slack_message",   label: "Slack",         icon: MessageSquare },
  { name: "search_drive",         label: "Drive Search",  icon: FolderSearch  },
  { name: "find_flights",         label: "Flights",       icon: Plane         },
];

interface Props {
  statuses: Record<string, ToolStatus>;
}

export function ToolStatusPanel({ statuses }: Props) {
  const [open, setOpen] = useState(false);

  const anyActive = Object.values(statuses).some((s) => s === "active");
  const anyDone   = Object.values(statuses).some((s) => s === "done");

  return (
    <div className="absolute left-3 bottom-4 z-10 flex flex-col items-start">
      {/* Expanded list — renders above the toggle button */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="mb-2 w-48 overflow-hidden rounded-xl border border-border bg-card/90 shadow-lg backdrop-blur-sm"
          >
            <div className="border-b border-border px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Tool Status
              </span>
            </div>
            <div className="py-1">
              {TOOLS.map(({ name, label, icon: Icon }) => {
                const status = statuses[name] ?? "idle";
                return (
                  <div key={name} className="flex items-center gap-2.5 px-3 py-[5px]">
                    {/* Pulsing ring + dot */}
                    <div className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                      {status === "active" && (
                        <>
                          <motion.span
                            className="absolute h-4 w-4 rounded-full bg-[#593aa7]/25"
                            animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                            transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
                          />
                          <span className="h-2 w-2 rounded-full bg-[#593aa7]" />
                        </>
                      )}
                      {status === "done" && (
                        <motion.span
                          className="h-2 w-2 rounded-full bg-green-500"
                          initial={{ scale: 1.4 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.3 }}
                        />
                      )}
                      {status === "idle" && (
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/20" />
                      )}
                    </div>

                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                        status === "active"
                          ? "text-[#593aa7]"
                          : status === "done"
                          ? "text-green-500"
                          : "text-muted-foreground/35"
                      }`}
                    />

                    <span
                      className={`truncate text-xs transition-colors ${
                        status === "active"
                          ? "font-medium text-foreground"
                          : status === "done"
                          ? "text-foreground"
                          : "text-muted-foreground/50"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle pill */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-all hover:border-[#593aa7]/40 hover:text-foreground"
      >
        {/* Global status dot */}
        <span
          className={`h-1.5 w-1.5 rounded-full transition-colors ${
            anyActive
              ? "animate-pulse bg-[#593aa7]"
              : anyDone
              ? "bg-green-500"
              : "bg-muted-foreground/30"
          }`}
        />
        <span>Tools</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronUp className="h-3 w-3" />
        </motion.span>
      </button>
    </div>
  );
}

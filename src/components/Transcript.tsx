"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/cn";

export type DisplayMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; result?: string }[];
  imageUrl?: string; // data URL — shown as thumbnail in user bubble
  timestamp?: Date;
};

function ToolCallBadge({ tc }: { tc: { name: string; result?: string } }) {
  const [open, setOpen] = useState(false);
  const hasResult = !!tc.result;

  return (
    <div className="rounded border border-[#593aa7]/20 bg-[#593aa7]/5 text-xs text-[#593aa7] overflow-hidden max-w-xs">
      <button
        onClick={() => hasResult && setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-1.5 px-2 py-1 text-left",
          hasResult ? "cursor-pointer hover:bg-[#593aa7]/10 transition-colors" : "cursor-default"
        )}
      >
        <span className="shrink-0">{hasResult ? "✓" : "⟳"}</span>
        <span className="font-medium truncate">{tc.name}</span>
        {hasResult && (
          open
            ? <ChevronDown className="ml-auto shrink-0 h-3 w-3 opacity-60" />
            : <ChevronRight className="ml-auto shrink-0 h-3 w-3 opacity-60" />
        )}
      </button>
      {open && tc.result && (
        <div className="border-t border-[#593aa7]/15 px-2 py-1.5 text-[#593aa7]/80 whitespace-pre-wrap break-words font-mono text-[11px] max-h-40 overflow-y-auto">
          {tc.result}
        </div>
      )}
    </div>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface TranscriptProps {
  messages: DisplayMessage[];
}

export function Transcript({ messages }: TranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          className="h-8 w-8 rounded-full bg-[#593aa7]/15"
        />
        <p className="text-sm text-muted-foreground">Say something to get started…</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full px-4">
      <div className="flex flex-col gap-3 py-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn("group flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}
            >
              {/* Tool call badges */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="flex flex-wrap gap-1 px-1">
                  {msg.toolCalls.map((tc, i) => (
                    <ToolCallBadge key={i} tc={tc} />
                  ))}
                </div>
              )}

              {/* Bubble */}
              <div
                className={cn(
                  "max-w-md rounded-lg text-sm leading-relaxed overflow-hidden",
                  msg.role === "user"
                    ? "rounded-tr-sm bg-[#593aa7] text-white"
                    : "rounded-tl-sm border border-border bg-card text-card-foreground shadow-sm"
                )}
              >
                {msg.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={msg.imageUrl}
                    alt="uploaded"
                    className="w-full max-h-48 object-cover"
                  />
                )}
                {msg.content && (
                  <p className="px-3.5 py-2 break-words">{msg.content}</p>
                )}
              </div>

              {/* Timestamp — visible on hover */}
              {msg.timestamp && (
                <span className="px-1 text-[10px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  {formatTime(msg.timestamp)}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

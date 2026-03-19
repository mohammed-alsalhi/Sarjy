"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/cn";

export type DisplayMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: { name: string; result?: string }[];
  imageUrl?: string; // data URL — shown as thumbnail in user bubble
};

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
      <div className="flex h-full items-center justify-center">
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
              className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}
            >
              {/* Tool call badges */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="flex flex-wrap gap-1 px-1">
                  {msg.toolCalls.map((tc, i) => (
                    <span
                      key={i}
                      className="rounded border border-[#593aa7]/20 bg-[#593aa7]/5 px-2 py-0.5 text-xs text-[#593aa7]"
                    >
                      {tc.result ? `✓ ${tc.name}: ${tc.result}` : `⟳ ${tc.name}…`}
                    </span>
                  ))}
                </div>
              )}

              {/* Bubble */}
              <div
                className={cn(
                  "max-w-sm rounded-lg text-sm leading-relaxed overflow-hidden",
                  msg.role === "user"
                    ? "rounded-tr-sm bg-[#593aa7] text-white"
                    : "rounded-tl-sm border border-border bg-white text-foreground shadow-sm"
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
                  <p className="px-3.5 py-2">{msg.content}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

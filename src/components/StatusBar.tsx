"use client";

import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { AssistantState } from "@/components/VoiceOrb";

const STATE_LABELS: Record<AssistantState, string> = {
  idle: "Ready",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Error",
};

const LANG_FLAGS: Record<string, string> = {
  en: "🇬🇧", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪",
  zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷", pt: "🇵🇹",
  ar: "🇸🇦", hi: "🇮🇳", ru: "🇷🇺", it: "🇮🇹",
  nl: "🇳🇱", pl: "🇵🇱", tr: "🇹🇷", sv: "🇸🇪",
};

interface StatusBarProps {
  state: AssistantState;
  userName?: string | null;
  userImage?: string | null;
  memoryOpen: boolean;
  onToggleMemory: () => void;
  language?: string;
}

export function StatusBar({ state, userName, userImage, memoryOpen, onToggleMemory, language }: StatusBarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <header className="flex h-14 items-center justify-between border-b border-border bg-white px-5">
        {/* Logo */}
        <span className="font-display text-lg font-semibold tracking-tight text-foreground">
          sarjy
        </span>

        {/* State indicator */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              state === "idle" && "bg-border",
              state === "listening" && "bg-[#593aa7]",
              state === "thinking" && "bg-yellow-400",
              state === "speaking" && "bg-green-500",
              state === "error" && "bg-red-400"
            )}
          />
          <AnimatePresence mode="wait">
            <motion.span
              key={state}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="text-xs font-medium text-muted-foreground"
            >
              {STATE_LABELS[state]}
            </motion.span>
          </AnimatePresence>
          {language && language !== "en" && LANG_FLAGS[language] && (
            <span className="text-base leading-none" title={language}>
              {LANG_FLAGS[language]}
            </span>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={memoryOpen ? "secondary" : "ghost"}
                size="icon"
                onClick={onToggleMemory}
                className={memoryOpen ? "border border-[#593aa7]/20 bg-[#593aa7]/5 text-[#593aa7]" : ""}
              >
                <Brain className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Memory</TooltipContent>
          </Tooltip>

          {userImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userImage} alt={userName ?? ""} className="mx-1 h-7 w-7 rounded-full border border-border" />
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => signOut()}>
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sign out</TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  );
}

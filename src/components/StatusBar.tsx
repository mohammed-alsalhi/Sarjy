"use client";

import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
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
  memoryCount?: number;
}

function StateDot({ state }: { state: AssistantState }) {
  const colorClass = {
    idle: "bg-border",
    listening: "bg-[#593aa7]",
    thinking: "bg-yellow-400",
    speaking: "bg-green-500",
    error: "bg-red-400",
  }[state];

  return (
    <span className="relative flex h-2 w-2 items-center justify-center">
      {(state === "listening" || state === "speaking") && (
        <span
          className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", colorClass)}
        />
      )}
      <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", colorClass)} />
    </span>
  );
}

export function StatusBar({ state, userName, userImage, memoryOpen, onToggleMemory, language, memoryCount }: StatusBarProps) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <TooltipProvider delayDuration={300}>
      <header className="relative flex h-14 items-center justify-between border-b border-border bg-background px-5">
        {/* Logo */}
        <span className="font-display text-lg font-semibold tracking-tight text-foreground">
          sarjy
        </span>

        {/* State indicator — absolutely centered */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <StateDot state={state} />
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
              <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{resolvedTheme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={memoryOpen ? "secondary" : "ghost"}
                size="icon"
                onClick={onToggleMemory}
                className={cn(
                  "relative",
                  memoryOpen ? "border border-[#593aa7]/20 bg-[#593aa7]/5 text-[#593aa7]" : ""
                )}
              >
                <Brain className="h-4 w-4" />
                {memoryCount != null && memoryCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#593aa7] text-[9px] font-semibold text-white leading-none">
                    {memoryCount > 99 ? "99" : memoryCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Memory</TooltipContent>
          </Tooltip>

          {/* User avatar + name */}
          {(userImage || userName) && (
            <div className="mx-1 flex items-center gap-1.5">
              {userImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userImage} alt={userName ?? ""} className="h-7 w-7 rounded-full border border-border" />
              )}
              {userName && (
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {userName.split(" ")[0]}
                </span>
              )}
            </div>
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

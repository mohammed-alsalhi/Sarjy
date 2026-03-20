"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MemoryFact } from "@/lib/memory";

interface MemoryPanelProps {
  open: boolean;
  onClose: () => void;
  refreshKey?: number;
  onCountChange?: (count: number) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  preference: "Preferences",
  todo: "Todos",
  fact: "Facts",
  reminder: "Reminders",
};

export function MemoryPanel({ open, onClose, refreshKey = 0, onCountChange }: MemoryPanelProps) {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/memory")
      .then((r) => r.json())
      .then((data) => {
        const loaded: MemoryFact[] = data.facts ?? [];
        setFacts(loaded);
        onCountChange?.(loaded.length);
      })
      .finally(() => setLoading(false));
  }, [open, refreshKey, onCountChange]);

  async function deleteFact(key: string) {
    await fetch(`/api/memory?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    setFacts((prev) => {
      const next = prev.filter((f) => f.key !== key);
      onCountChange?.(next.length);
      return next;
    });
  }

  async function clearAll() {
    await fetch("/api/memory", { method: "DELETE" });
    setFacts([]);
    onCountChange?.(0);
    setConfirmClear(false);
  }

  const grouped = facts.reduce<Record<string, MemoryFact[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="absolute right-0 top-0 z-20 flex h-full w-72 flex-col border-l border-border bg-background shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Memory</span>
              {facts.length > 0 && (
                <span className="rounded-full bg-[#593aa7]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#593aa7]">
                  {facts.length}
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 px-3 py-2">
            {loading && (
              <p className="py-8 text-center text-xs text-muted-foreground">Loading…</p>
            )}
            {!loading && facts.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No memories yet. Start talking!
              </p>
            )}
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="mb-4">
                <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABELS[category] ?? category}
                </p>
                <div className="flex flex-col gap-1">
                  {items.map((fact) => (
                    <div
                      key={fact.id}
                      className="group flex items-start justify-between gap-2 rounded-md border border-border bg-secondary px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">{fact.key}</p>
                        <p className="text-xs text-muted-foreground break-words">{fact.value}</p>
                      </div>
                      <button
                        onClick={() => deleteFact(fact.key)}
                        className="mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </ScrollArea>

          {facts.length > 0 && (
            <div className="border-t border-border p-3">
              <AnimatePresence mode="wait">
                {confirmClear ? (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                      This will delete all {facts.length} memories.
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => setConfirmClear(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={clearAll}
                      >
                        Delete all
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50"
                      onClick={() => setConfirmClear(true)}
                    >
                      Clear all memories
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

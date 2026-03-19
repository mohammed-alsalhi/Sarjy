"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MemoryFact } from "@/lib/memory";

interface MemoryPanelProps {
  open: boolean;
  onClose: () => void;
  refreshKey?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  preference: "Preferences",
  todo: "Todos",
  fact: "Facts",
  reminder: "Reminders",
};

export function MemoryPanel({ open, onClose, refreshKey = 0 }: MemoryPanelProps) {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/memory")
      .then((r) => r.json())
      .then((data) => setFacts(data.facts ?? []))
      .finally(() => setLoading(false));
  }, [open, refreshKey]);

  async function deleteFact(key: string) {
    await fetch(`/api/memory?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    setFacts((prev) => prev.filter((f) => f.key !== key));
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
          className="absolute right-0 top-0 z-20 flex h-full w-72 flex-col border-l border-border bg-white shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Memory</span>
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
                        <p className="truncate text-xs text-muted-foreground">{fact.value}</p>
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

          <div className="border-t border-border p-3">
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={async () => {
                await fetch("/api/memory", { method: "DELETE" });
                setFacts([]);
              }}
            >
              Clear all memories
            </Button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

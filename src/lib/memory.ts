import { createServerSupabase } from "./supabase";
import type { Database } from "@/types/database";

type MemoryFactInsert = Database["public"]["Tables"]["memory_facts"]["Insert"];

export type MemoryFact = {
  id: string;
  key: string;
  value: string;
  category: "preference" | "todo" | "fact" | "reminder";
  created_at: string;
};

/** Fetch all facts for a user — injected into every system prompt */
export async function getUserFacts(userId: string): Promise<MemoryFact[]> {
  const db = createServerSupabase();
  const { data } = await db
    .from("memory_facts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as MemoryFact[] | null) ?? [];
}

/** Upsert a fact (by key) */
export async function upsertFact(
  userId: string,
  fact: Omit<MemoryFact, "id" | "created_at">
): Promise<void> {
  const db = createServerSupabase();
  const payload: MemoryFactInsert = { user_id: userId, ...fact, updated_at: new Date().toISOString() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.from("memory_facts").upsert(payload as any, { onConflict: "user_id,key" });
}

/** Delete a fact by key */
export async function deleteFact(userId: string, key: string): Promise<void> {
  const db = createServerSupabase();
  await db.from("memory_facts").delete().eq("user_id", userId).eq("key", key);
}

/** Build the memory section of the system prompt */
export function buildMemoryContext(facts: MemoryFact[]): string {
  if (facts.length === 0) return "";

  const sections: Record<string, string[]> = {};
  for (const f of facts) {
    if (!sections[f.category]) sections[f.category] = [];
    sections[f.category].push(`• ${f.key}: ${f.value}`);
  }

  const lines = ["## What you remember about this user:"];
  for (const [cat, items] of Object.entries(sections)) {
    lines.push(`\n**${cat.charAt(0).toUpperCase() + cat.slice(1)}s:**`);
    lines.push(...items);
  }
  return lines.join("\n");
}

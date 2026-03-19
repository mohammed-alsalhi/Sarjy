import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserFacts, deleteFact } from "@/lib/memory";
import { createServerSupabase } from "@/lib/supabase";
import { clearConversation } from "@/lib/redis";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const facts = await getUserFacts(session.user.id);
  return Response.json({ facts });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  if (key) {
    // Delete single fact
    await deleteFact(session.user.id, key);
  } else {
    // Clear all facts + conversation history
    const db = createServerSupabase();
    await db.from("memory_facts").delete().eq("user_id", session.user.id);
    await clearConversation(session.user.id);
  }

  return Response.json({ ok: true });
}

import bcrypt from "bcryptjs";
import { createServerSupabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { email, password, name } = await req.json();

  if (!email || !password) {
    return Response.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const db = createServerSupabase();
  const normalized = email.toLowerCase().trim();

  // Check for existing credentials account
  const { data: existing } = await db
    .from("credential_users")
    .select("id")
    .eq("email", normalized)
    .single();

  if (existing) {
    return Response.json({ error: "An account with this email already exists. Try signing in." }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { error } = await db.from("credential_users").insert({
    email: normalized,
    name: name?.trim() || null,
    password_hash,
  });

  if (error) {
    return Response.json({ error: "Failed to create account. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}

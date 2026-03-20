import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createServerSupabase } from "@/lib/supabase";

async function refreshAccessToken(token: JWT): Promise<JWT> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken as string,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return {
    ...token,
    accessToken: data.access_token,
    accessTokenExpires: Date.now() + data.expires_in * 1000,
    refreshToken: data.refresh_token ?? token.refreshToken,
  } as JWT;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const db = createServerSupabase();
        const { data: user } = await db
          .from("credential_users")
          .select("*")
          .eq("email", credentials.email.toLowerCase())
          .single();

        if (!user) {
          // Check if they might have signed up via Google (no credentials record found)
          throw new Error("NO_ACCOUNT");
        }

        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) throw new Error("INVALID_PASSWORD");

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/drive.readonly",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }): Promise<JWT> {
      // Credentials sign-in: user object is set, no account
      if (user && !account) {
        token.sub = user.id;
        token.accessTokenExpires = Infinity;
        return token;
      }

      if (account) {
        token.sub = account.providerAccountId;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000;
      }
      // Credentials users don't have expiring tokens
      if (!token.refreshToken) return token;
      // Return token if still valid
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }
      // Access token expired — refresh it
      try {
        return await refreshAccessToken(token);
      } catch {
        return { ...token, error: "RefreshAccessTokenError" } as JWT;
      }
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.accessToken = token.accessToken as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};

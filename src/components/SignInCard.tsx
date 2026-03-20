"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

type Mode = "signin" | "register";

export function SignInCard() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Registration failed.");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error === "NO_ACCOUNT") {
        setError("No account found with this email. Did you sign in with Google before?");
      } else if (result?.error === "INVALID_PASSWORD") {
        setError("Incorrect password.");
      } else if (result?.error) {
        setError("Sign in failed. Please try again.");
      } else {
        // Successful — NextAuth will refresh the page
        window.location.href = "/";
      }
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(89,58,167,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(89,58,167,0.04) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      {/* Subtle purple glow at top */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-20"
        style={{
          background: "radial-gradient(ellipse at top, #593aa7, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-6 rounded-lg border border-border bg-white px-10 py-12 shadow-sm"
        style={{ minWidth: 360, width: 360 }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-display text-4xl font-semibold tracking-tight text-foreground">
            sarjy
          </span>
          <p className="text-xs text-muted-foreground tracking-widest uppercase">
            Voice · Memory · Intelligence
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {["Groq Whisper", "Claude AI", "ElevenLabs"].map((f) => (
            <span
              key={f}
              className="rounded border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground"
            >
              {f}
            </span>
          ))}
        </div>

        {/* Mode tabs */}
        <div className="flex w-full rounded-md border border-border overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className={`flex-1 py-2 transition-colors ${
              mode === "signin"
                ? "bg-foreground text-background font-medium"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`flex-1 py-2 transition-colors ${
              mode === "register"
                ? "bg-foreground text-background font-medium"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            Create account
          </button>
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
          <AnimatePresence initial={false}>
            {mode === "register" && (
              <motion.div
                key="name"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            placeholder="Password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <AnimatePresence>
            {error && (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 border border-red-100"
              >
                {error}
                {error.includes("Google") && (
                  <button
                    type="button"
                    onClick={() => signIn("google")}
                    className="ml-1 underline underline-offset-2 font-medium"
                  >
                    Sign in with Google
                  </button>
                )}
              </motion.p>
            )}
          </AnimatePresence>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Google */}
        <Button
          size="lg"
          variant="outline"
          className="w-full gap-3"
          onClick={() => signIn("google")}
        >
          <GoogleIcon />
          Continue with Google
        </Button>

        <p className="text-center text-xs text-muted-foreground/70">
          Your conversations are private and stored securely.
        </p>
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ImagePlus, X } from "lucide-react";
import { VoiceOrb } from "@/components/VoiceOrb";
import { Transcript } from "@/components/Transcript";
import { StatusBar } from "@/components/StatusBar";
import { MemoryPanel } from "@/components/MemoryPanel";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";

function fileToImageData(file: File): Promise<{ data: string; mimeType: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const mimeType = result.match(/:(.*?);/)?.[1] ?? "image/jpeg";
      const data = result.split(",")[1] ?? "";
      resolve({ data, mimeType, dataUrl: result });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function VoiceAssistant() {
  const { data: session } = useSession();
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryRefreshKey, setMemoryRefreshKey] = useState(0);
  const [memoryCount, setMemoryCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { state, messages, language, analyserRef, pendingImage, setPendingImage, startListening, stopListening } =
    useVoiceAssistant({ onMemoryUpdate: () => setMemoryRefreshKey((k) => k + 1) });

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset input so the same file can be re-selected
      e.target.value = "";
      try {
        const imageData = await fileToImageData(file);
        setPendingImage(imageData);
      } catch {
        // ignore
      }
    },
    [setPendingImage]
  );

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(89,58,167,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(89,58,167,0.03) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <StatusBar
        state={state}
        userName={session?.user?.name}
        userImage={session?.user?.image}
        memoryOpen={memoryOpen}
        onToggleMemory={() => setMemoryOpen((o) => !o)}
        language={language}
        memoryCount={memoryCount}
      />

      <main className="relative flex flex-1 overflow-hidden">
        {/* Left / center content */}
        <div className="flex flex-1 flex-col items-center overflow-hidden">
          {/* Transcript — upper portion */}
          <div className="w-full max-w-xl flex-1 overflow-hidden py-2">
            <Transcript messages={messages} />
          </div>

          {/* Image preview strip */}
          {pendingImage && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#593aa7]/20 bg-card px-3 py-2 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImage.dataUrl}
                alt="pending"
                className="h-10 w-10 rounded object-cover border border-border"
              />
              <span className="text-xs text-muted-foreground">Image ready — speak your question</span>
              <button
                onClick={() => setPendingImage(null)}
                className="ml-auto rounded p-0.5 hover:bg-secondary transition-colors"
                aria-label="Remove image"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Orb + image button row */}
          <div className="flex shrink-0 flex-col items-center pb-10 pt-4">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex items-center justify-center gap-4">
              {/* Image upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-all hover:border-[#593aa7]/40 hover:shadow-md focus:outline-none"
                title="Attach image"
              >
                <ImagePlus className="h-4 w-4 text-muted-foreground" />
              </button>

              <VoiceOrb
                state={state}
                onStartListening={startListening}
                onStopListening={stopListening}
                analyserRef={analyserRef}
              />

              {/* Spacer to keep orb centred */}
              <div className="h-10 w-10" />
            </div>

            {/* Status label — below the orb, outside the alignment row */}
            <span className="mt-3 text-xs text-muted-foreground tracking-wide uppercase font-medium">
              {state === "idle" && "Tap to speak"}
              {state === "listening" && "Listening…"}
              {state === "thinking" && "Thinking…"}
              {state === "speaking" && "Speaking…"}
              {state === "error" && "Error"}
            </span>
          </div>
        </div>

        {/* Memory panel — slides in from right */}
        <MemoryPanel
          open={memoryOpen}
          onClose={() => setMemoryOpen(false)}
          refreshKey={memoryRefreshKey}
          onCountChange={setMemoryCount}
        />
      </main>
    </div>
  );
}

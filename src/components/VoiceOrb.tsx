"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import { cn } from "@/lib/cn";

export type AssistantState = "idle" | "listening" | "thinking" | "speaking" | "error";

// Frequency bin indices to sample for each of the 5 bars (low → high)
const FREQ_BINS = [3, 6, 10, 16, 22];

interface VoiceOrbProps {
  state: AssistantState;
  onStartListening: () => void;
  onStopListening: () => void;
  analyserRef?: React.RefObject<AnalyserNode | null>;
}

export function VoiceOrb({ state, onStartListening, onStopListening, analyserRef }: VoiceOrbProps) {
  const isListening = state === "listening";
  const isThinking = state === "thinking";
  const isSpeaking = state === "speaking";
  const isActive = isListening || isSpeaking;

  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const animFrameRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Amplitude animation during speaking
  useEffect(() => {
    if (!isSpeaking) {
      cancelAnimationFrame(animFrameRef.current);
      // Reset bar heights
      barRefs.current.forEach((bar) => {
        if (bar) bar.style.height = "20px";
      });
      return;
    }

    function animate() {
      const analyser = analyserRef?.current;
      if (!analyser) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      if (!dataArrayRef.current || dataArrayRef.current.length !== analyser.frequencyBinCount) {
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      }

      analyser.getByteFrequencyData(dataArrayRef.current);

      barRefs.current.forEach((bar, i) => {
        if (!bar || !dataArrayRef.current) return;
        const freq = dataArrayRef.current[FREQ_BINS[i]] ?? 0;
        const height = 4 + (freq / 255) * 28; // 4px → 32px
        bar.style.height = `${height}px`;
      });

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isSpeaking, analyserRef]);

  function handleClick() {
    if (state === "idle" || state === "error") onStartListening();
    else if (state === "listening") onStopListening();
  }

  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
        {/* Ping ring — listening */}
        {isListening && (
          <span
            className="animate-ping-slow absolute inline-flex rounded-full"
            style={{ width: 200, height: 200, background: "rgba(89,58,167,0.12)" }}
          />
        )}

        {/* Spinning border — thinking */}
        {isThinking && (
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 200,
              height: 200,
              background: "conic-gradient(from 0deg, #593aa7, #4d65ff, transparent, #593aa7)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          />
        )}

        {/* Orb button */}
        <motion.button
          onClick={handleClick}
          className={cn(
            "relative z-10 flex items-center justify-center rounded-full border bg-white transition-all focus:outline-none",
            "border-border shadow-sm",
            isActive && "border-[#593aa7]/40 shadow-md",
            state === "error" && "border-red-300"
          )}
          style={{ width: 176, height: 176 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          animate={
            state === "idle"
              ? {
                  boxShadow: [
                    "0 1px 3px rgba(0,0,0,0.06)",
                    "0 0 0 6px rgba(89,58,167,0.06), 0 1px 3px rgba(0,0,0,0.06)",
                    "0 1px 3px rgba(0,0,0,0.06)",
                  ],
                }
              : {}
          }
          transition={state === "idle" ? { duration: 3, repeat: Infinity } : {}}
        >
          {/* Waveform bars */}
          {(isListening || isSpeaking) ? (
            <div className="flex items-center gap-1" style={{ height: 36 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  ref={(el) => { barRefs.current[i] = el; }}
                  className={isListening ? "waveform-bar" : undefined}
                  style={{
                    display: "inline-block",
                    width: 3,
                    height: 20,
                    borderRadius: 2,
                    background: "#593aa7",
                    animationDelay: isListening ? `${i * 0.15}s` : undefined,
                    transition: isSpeaking ? "none" : undefined,
                  }}
                />
              ))}
            </div>
          ) : isThinking ? (
            <motion.div
              className="h-6 w-6 rounded-full border-2 border-t-transparent"
              style={{ borderColor: "#593aa7", borderTopColor: "transparent" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
          ) : (
            <Mic
              className={cn(
                "h-7 w-7 transition-colors",
                state === "error" ? "text-red-400" : "text-muted-foreground"
              )}
            />
          )}
        </motion.button>
    </div>
  );
}

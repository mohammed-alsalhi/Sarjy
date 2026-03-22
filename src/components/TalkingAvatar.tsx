"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AssistantState } from "./VoiceOrb";

const SIZE = 176;
const CX = SIZE / 2; // 88
const CY = SIZE / 2; // 88
const FACE_R = 76;

// Eye geometry
const EYE_L_X = 68;
const EYE_R_X = 108;
const EYE_Y = 76;
const EYE_RX = 5.5;
const EYE_RY = 5.5;

// Brow geometry
const BROW_L = { x1: 62, y1: 64, x2: 76, y2: 61 };
const BROW_R = { x1: 100, y1: 61, x2: 114, y2: 64 };

/** Returns a closed bezier path for the mouth at a given amplitude (0–1). */
function getMouthPath(amp: number): string {
  const topY = 110 - amp * 4;
  const topCtrlY = topY - 2 - amp * 5;
  const btmCtrlY = topY + 2 + amp * 12;
  return `M 70,${topY} C 79,${topCtrlY} 97,${topCtrlY} 106,${topY} C 97,${btmCtrlY} 79,${btmCtrlY} 70,${topY} Z`;
}

interface TalkingAvatarProps {
  state: AssistantState;
  onStartListening: () => void;
  onStopListening: () => void;
  analyserRef?: React.RefObject<AnalyserNode | null>;
}

export function TalkingAvatar({ state, onStartListening, onStopListening, analyserRef }: TalkingAvatarProps) {
  const isListening = state === "listening";
  const isThinking = state === "thinking";
  const isSpeaking = state === "speaking";
  const isError = state === "error";

  // Direct DOM refs for perf-critical animations
  const mouthRef = useRef<SVGPathElement>(null);
  const leftEyeRef = useRef<SVGEllipseElement>(null);
  const rightEyeRef = useRef<SVGEllipseElement>(null);

  const animFrameRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Mouth animation (rAF → direct DOM) ---
  useEffect(() => {
    if (!isSpeaking) {
      cancelAnimationFrame(animFrameRef.current);
      if (mouthRef.current) mouthRef.current.setAttribute("d", getMouthPath(0));
      return;
    }

    function tick() {
      const analyser = analyserRef?.current;
      if (analyser) {
        if (!dataArrayRef.current || dataArrayRef.current.length !== analyser.frequencyBinCount) {
          dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
        }
        analyser.getByteFrequencyData(dataArrayRef.current);

        // Average voice-range bins
        let sum = 0;
        const bins = [3, 5, 7, 9, 12, 15, 19];
        for (const b of bins) sum += dataArrayRef.current[b] ?? 0;
        const amp = Math.min(1, (sum / bins.length / 255) * 2.2); // boost sensitivity

        if (mouthRef.current) mouthRef.current.setAttribute("d", getMouthPath(amp));
      }
      animFrameRef.current = requestAnimationFrame(tick);
    }

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isSpeaking, analyserRef]);

  // --- Blinking (setTimeout → direct DOM) ---
  useEffect(() => {
    function blink() {
      // Close eyes
      leftEyeRef.current?.setAttribute("ry", "0");
      rightEyeRef.current?.setAttribute("ry", "0");
      // Re-open after 110ms
      setTimeout(() => {
        leftEyeRef.current?.setAttribute("ry", String(EYE_RY));
        rightEyeRef.current?.setAttribute("ry", String(EYE_RY));
      }, 110);
    }

    function schedule() {
      const delay = 2800 + Math.random() * 2200;
      blinkTimerRef.current = setTimeout(() => {
        blink();
        schedule();
      }, delay);
    }

    schedule();
    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, []);

  // Pupil offsets by state
  const pupilDx = isThinking ? -1.5 : 0;
  const pupilDy = isThinking ? -2 : isListening ? 1 : 0;

  // Brow lift for listening
  const browDy = isListening ? -3 : 0;

  function handleClick() {
    if (state === "idle" || state === "error") onStartListening();
    else if (state === "listening") onStopListening();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>

        {/* Ping ring — listening */}
        {isListening && (
          <span
            className="animate-ping-slow absolute inline-flex rounded-full"
            style={{ width: 200, height: 200, background: "rgba(89,58,167,0.12)" }}
          />
        )}

        {/* Spinning gradient ring — thinking */}
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

        {/* Error pulse ring */}
        {isError && (
          <motion.div
            className="absolute rounded-full border-2 border-red-300"
            style={{ width: 200, height: 200 }}
            animate={{ opacity: [0.6, 0.2, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Avatar button */}
        <motion.button
          onClick={handleClick}
          className={cn(
            "relative z-10 flex items-center justify-center rounded-full border bg-card transition-all focus:outline-none overflow-hidden",
            "border-border shadow-sm",
            (isListening || isSpeaking) && "border-[#593aa7]/40 shadow-md",
            isError && "border-red-300"
          )}
          style={{ width: SIZE, height: SIZE, padding: 0 }}
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
          {isError ? (
            <AlertCircle className="h-8 w-8 text-red-400" />
          ) : (
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              width={SIZE}
              height={SIZE}
              xmlns="http://www.w3.org/2000/svg"
              style={{ color: "hsl(var(--card-foreground))" }}
            >
              {/* Face */}
              <circle cx={CX} cy={CY} r={FACE_R} fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1.5" />

              {/* Eyebrows — lift when listening */}
              <motion.line
                x1={BROW_L.x1} y1={BROW_L.y1 + browDy}
                x2={BROW_L.x2} y2={BROW_L.y2 + browDy}
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                animate={{ y1: BROW_L.y1 + browDy, y2: BROW_L.y2 + browDy }}
                transition={{ duration: 0.25 }}
              />
              <motion.line
                x1={BROW_R.x1} y1={BROW_R.y1 + browDy}
                x2={BROW_R.x2} y2={BROW_R.y2 + browDy}
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                animate={{ y1: BROW_R.y1 + browDy, y2: BROW_R.y2 + browDy }}
                transition={{ duration: 0.25 }}
              />

              {/* Left eye */}
              <ellipse
                ref={leftEyeRef}
                cx={EYE_L_X} cy={EYE_Y}
                rx={EYE_RX} ry={EYE_RY}
                fill="currentColor"
                style={{ transition: "ry 0.06s ease" }}
              />
              {/* Left pupil highlight */}
              <circle
                cx={EYE_L_X + pupilDx + 1.8} cy={EYE_Y + pupilDy - 1.8}
                r={1.4} fill="hsl(var(--muted))" opacity={0.7}
                style={{ transition: "cx 0.3s ease, cy 0.3s ease" }}
              />

              {/* Right eye */}
              <ellipse
                ref={rightEyeRef}
                cx={EYE_R_X} cy={EYE_Y}
                rx={EYE_RX} ry={EYE_RY}
                fill="currentColor"
                style={{ transition: "ry 0.06s ease" }}
              />
              {/* Right pupil highlight */}
              <circle
                cx={EYE_R_X + pupilDx + 1.8} cy={EYE_Y + pupilDy - 1.8}
                r={1.4} fill="hsl(var(--muted))" opacity={0.7}
                style={{ transition: "cx 0.3s ease, cy 0.3s ease" }}
              />

              {/* Mouth — driven by rAF when speaking */}
              <path
                ref={mouthRef}
                d={getMouthPath(0)}
                fill="currentColor"
                style={{ transition: isSpeaking ? "none" : "d 0.2s ease" }}
              />
            </svg>
          )}
        </motion.button>
      </div>

      {/* Error label */}
      <AnimatePresence>
        {isError && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-red-400 font-medium"
          >
            Something went wrong — tap to retry
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

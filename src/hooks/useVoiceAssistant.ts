"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MicVAD } from "@ricky0123/vad-web";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type { AssistantState } from "@/components/VoiceOrb";
import type { DisplayMessage } from "@/components/Transcript";

interface UseVoiceAssistantOptions {
  onMemoryUpdate?: () => void;
}

// Encode Float32Array PCM to WAV blob
function encodeWAV(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Split accumulated text into complete sentences and a trailing remainder.
 * Sentences end at [.!?] followed by a space (or newline).
 */
function extractSentences(text: string): { complete: string[]; remaining: string } {
  const re = /[^.!?]*[.!?]+(?:\s|$)/g;
  const complete: string[] = [];
  let lastEnd = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    complete.push(match[0].trim());
    lastEnd = match.index + match[0].length;
  }
  return { complete, remaining: text.slice(lastEnd) };
}

interface PendingImage {
  data: string;        // base64
  mimeType: string;
  dataUrl: string;     // for thumbnail display
}

export type ToolStatus = "idle" | "active" | "done";

export function useVoiceAssistant({ onMemoryUpdate }: UseVoiceAssistantOptions = {}) {
  const [state, setState] = useState<AssistantState>("idle");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [language, setLanguage] = useState<string>("en");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [toolStatuses, setToolStatuses] = useState<Record<string, ToolStatus>>({});
  const toolResetTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const vadRef = useRef<MicVAD | null>(null);
  const activeRef = useRef(false);
  const stateRef = useRef<AssistantState>("idle");
  const pendingImageRef = useRef<PendingImage | null>(null);

  // Keep refs in sync so stale VAD callbacks can read current values
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { pendingImageRef.current = pendingImage; }, [pendingImage]);

  const { enqueue, stop, analyser } = useAudioPlayer({
    onStart: () => setState("speaking"),
    onComplete: () => {
      setState("idle");
      // Auto-restart listening after TTS finishes
      activeRef.current = true;
      getVAD().then((vad) => {
        vad.start();
        setState("listening");
      });
    },
  });

  // Barge-in: stop audio when user starts speaking mid-response
  const stopRef = useRef(stop);
  useEffect(() => { stopRef.current = stop; }, [stop]);

  // Lazy-init VAD on first use
  async function getVAD(): Promise<MicVAD> {
    if (vadRef.current) return vadRef.current;

    const vad = await MicVAD.new({
      baseAssetPath: "/vad/",
      model: "v5",
      onSpeechStart: () => {
        // Barge-in: cut TTS immediately when user speaks
        if (stateRef.current === "speaking") {
          stopRef.current();
          activeRef.current = true;
          setState("listening");
        }
      },
      onSpeechEnd: async (audio: Float32Array) => {
        if (!activeRef.current) return;
        activeRef.current = false;

        const wav = encodeWAV(audio);
        const fd = new FormData();
        fd.append("audio", wav, "audio.wav");

        setState("thinking");
        try {
          const { transcript, language: lang } = await fetch("/api/stt", {
            method: "POST",
            body: fd,
          }).then((r) => r.json());

          if (lang) setLanguage(lang);
          await sendMessage(transcript, lang ?? "en");
        } catch {
          setState("error");
          setTimeout(() => setState("idle"), 2000);
        }
      },
    });

    vadRef.current = vad;
    return vad;
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      vadRef.current?.destroy();
    };
  }, []);

  async function sendMessage(transcript: string, detectedLanguage = "en") {
    if (!transcript.trim()) {
      setState("idle");
      return;
    }

    // Reset tool statuses for this new turn
    setToolStatuses({});

    // Capture and clear pending image — read from ref to avoid stale closure
    const image = pendingImageRef.current;
    if (image) {
      pendingImageRef.current = null;
      setPendingImage(null);
    }

    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: transcript,
      imageUrl: image?.dataUrl,
    };
    setMessages((prev) => [...prev, userMsg]);
    setState("thinking");

    const assistantMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      toolCalls: [],
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcript,
          language: detectedLanguage,
          imageBase64: image?.data,
          imageMimeType: image?.mimeType,
        }),
      });

      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let hadMemoryUpdate = false;
      let lineBuffer = "";
      // Sentence streaming state
      let sentenceBuffer = "";
      let anyTTSEnqueued = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "text") {
              sentenceBuffer += event.delta;
              // Update transcript display
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: m.content + event.delta }
                    : m
                )
              );
              // Extract complete sentences and stream to TTS
              const { complete, remaining } = extractSentences(sentenceBuffer);
              for (const sentence of complete) {
                enqueue(sentence);
                anyTTSEnqueued = true;
              }
              sentenceBuffer = remaining;
            } else if (event.type === "tool_start") {
              setToolStatuses((prev) => ({ ...prev, [event.name]: "active" }));
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, toolCalls: [...(m.toolCalls ?? []), { name: event.name }] }
                    : m
                )
              );
            } else if (event.type === "tool_result") {
              setToolStatuses((prev) => ({ ...prev, [event.name]: "done" }));
              // Clear any existing timer for this tool then schedule reset
              if (toolResetTimers.current[event.name]) clearTimeout(toolResetTimers.current[event.name]);
              toolResetTimers.current[event.name] = setTimeout(() => {
                setToolStatuses((prev) => ({ ...prev, [event.name]: "idle" }));
              }, 3000);
              if (event.name === "save_memory" || event.name === "delete_memory") {
                hadMemoryUpdate = true;
              }
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantMsg.id) return m;
                  const toolCalls = (m.toolCalls ?? []).map((tc) =>
                    tc.name === event.name && !tc.result ? { ...tc, result: event.result } : tc
                  );
                  return { ...m, toolCalls };
                })
              );
            } else if (event.type === "error") {
              throw new Error(event.message ?? "Stream error");
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }

      // Flush any remaining partial sentence
      if (sentenceBuffer.trim()) {
        enqueue(sentenceBuffer.trim());
        anyTTSEnqueued = true;
      }

      if (hadMemoryUpdate) onMemoryUpdate?.();
      // If no TTS was enqueued (tool-only response with no text), go idle
      if (!anyTTSEnqueued) setState("idle");
    } catch {
      setState("error");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: "Something went wrong. Please try again." }
            : m
        )
      );
      setTimeout(() => setState("idle"), 2000);
    }
  }

  const startListening = useCallback(async () => {
    if (state !== "idle" && state !== "error") return;
    activeRef.current = true;
    const vad = await getVAD();
    vad.start();
    setState("listening");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const stopListening = useCallback(() => {
    activeRef.current = false;
    vadRef.current?.pause();
    setState("idle");
  }, []);

  return { state, messages, language, analyserRef: analyser, pendingImage, setPendingImage, startListening, stopListening, toolStatuses };
}

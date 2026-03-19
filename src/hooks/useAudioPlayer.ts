"use client";

import { useRef, useCallback, useEffect } from "react";

interface UseAudioPlayerOptions {
  onStart?: () => void;
  onComplete?: () => void;
}

export function useAudioPlayer({ onStart, onComplete }: UseAudioPlayerOptions = {}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Queue of pending TTS fetches (started in parallel as sentences come in)
  const queueRef = useRef<Promise<AudioBuffer | null>[]>([]);
  const playingRef = useRef(false);
  const stoppedRef = useRef(false);

  // Stable refs for callbacks so closures don't go stale
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onStartRef.current = onStart; }, [onStart]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  function getContext(): AudioContext {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }

  async function fetchBuffer(text: string): Promise<AudioBuffer | null> {
    try {
      const ctx = getContext();
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return await ctx.decodeAudioData(ab);
    } catch {
      return null;
    }
  }

  async function playNext(): Promise<void> {
    if (stoppedRef.current || queueRef.current.length === 0) {
      playingRef.current = false;
      if (!stoppedRef.current) onCompleteRef.current?.();
      return;
    }

    const bufferPromise = queueRef.current.shift()!;
    const buffer = await bufferPromise;

    if (stoppedRef.current) {
      playingRef.current = false;
      return;
    }

    if (!buffer) {
      // Skip failed fetch, try next
      playNext();
      return;
    }

    const ctx = getContext();
    if (ctx.state === "suspended") await ctx.resume();

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    sourceRef.current = source;

    source.onended = () => {
      analyserRef.current = null;
      if (!stoppedRef.current) playNext();
    };

    source.start();
  }

  /** Add a sentence to the TTS queue. Fetches audio immediately in parallel. */
  const enqueue = useCallback((text: string) => {
    if (!text.trim()) return;
    stoppedRef.current = false;
    queueRef.current.push(fetchBuffer(text));
    if (!playingRef.current) {
      playingRef.current = true;
      onStartRef.current?.();
      playNext();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Convenience: stop everything then enqueue a single text (original API). */
  const play = useCallback((text: string) => {
    stop();
    enqueue(text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    queueRef.current = [];
    try { sourceRef.current?.stop(); } catch { /* already stopped */ }
    analyserRef.current = null;
    playingRef.current = false;
  }, []);

  return { play, enqueue, stop, analyser: analyserRef };
}

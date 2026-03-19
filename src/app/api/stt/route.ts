export const maxDuration = 30;

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const audio = formData.get("audio") as File | null;
  if (!audio) return Response.json({ error: "No audio" }, { status: 400 });

  const transcription = await groq.audio.transcriptions.create({
    file: audio,
    model: "whisper-large-v3-turbo",
    response_format: "verbose_json",
  }) as unknown as { text: string; language?: string };

  return Response.json({
    transcript: transcription.text,
    language: transcription.language ?? "en",
  });
}

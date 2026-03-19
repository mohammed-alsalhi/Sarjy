export const maxDuration = 30;

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await req.json();
  if (!text) return Response.json({ error: "No text" }, { status: 400 });

  const stream = await client.textToSpeech.convert(
    process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM",
    {
      modelId: "eleven_turbo_v2_5",
      text,
      outputFormat: "mp3_44100_128",
    }
  );

  // Collect ReadableStream chunks into a single buffer
  const arrayBuffer = await new Response(stream).arrayBuffer();

  return new Response(arrayBuffer, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}

export const maxDuration = 60;

import Anthropic from "@anthropic-ai/sdk";
import { getUserFacts, buildMemoryContext } from "@/lib/memory";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Receives transcribed speech from Twilio Gather, runs it through Claude,
// returns TwiML with the spoken response and loops back for another turn.
export async function POST(req: Request) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const formData = await req.formData();
  const speechResult = formData.get("SpeechResult") as string | null;

  if (!speechResult) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, I didn't catch that.</Say>
  <Gather input="speech" action="${baseUrl}/api/twilio/gather" speechTimeout="auto" language="en-US">
  </Gather>
</Response>`;
    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  let replyText = "I'm sorry, I couldn't process that right now.";

  try {
    // Use a generic phone user ID so memory isn't tied to a web session
    const phoneUserId = "twilio-phone-user";
    const facts = await getUserFacts(phoneUserId);
    const memoryContext = buildMemoryContext(facts);
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const systemPrompt = `You are Sarjy, a helpful voice assistant answering a phone call. Be concise — responses must be short (1–3 sentences) since they will be read aloud.

Today is ${today}.${memoryContext ? `\n\n${memoryContext}` : ""}

Keep answers brief and clear. Do not use markdown, bullet points, or symbols.`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: "user", content: speechResult }],
    });

    const block = response.content[0];
    if (block.type === "text") replyText = block.text;
  } catch {
    // Keep default replyText
  }

  // Escape XML special chars
  const safe = replyText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${safe}</Say>
  <Gather input="speech" action="${baseUrl}/api/twilio/gather" speechTimeout="auto" language="en-US">
  </Gather>
  <Say voice="Polly.Joanna">Is there anything else I can help you with?</Say>
</Response>`;

  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}

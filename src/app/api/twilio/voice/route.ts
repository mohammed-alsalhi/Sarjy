export const maxDuration = 60;

// Twilio inbound call webhook.
// Returns TwiML that greets the caller and starts listening for speech.
export async function POST() {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Hi, I'm Sarjy. How can I help you today?</Say>
  <Gather input="speech" action="${baseUrl}/api/twilio/gather" speechTimeout="auto" language="en-US">
  </Gather>
  <Say voice="Polly.Joanna">I didn't catch that. Please call again and try speaking clearly.</Say>
</Response>`;

  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}

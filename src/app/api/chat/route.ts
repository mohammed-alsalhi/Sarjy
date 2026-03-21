export const maxDuration = 60; // Vercel: allow up to 60s for streaming responses

import { getServerSession } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { authOptions } from "@/lib/auth";
import { getConversationHistory, appendMessage } from "@/lib/redis";
import { getUserFacts, upsertFact, deleteFact, buildMemoryContext } from "@/lib/memory";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const TOOLS: Anthropic.Tool[] = [
  {
    name: "save_memory",
    description: "Save something important to remember about the user across sessions.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Short identifier, e.g. 'preferred_name'" },
        value: { type: "string", description: "The value to remember" },
        category: {
          type: "string",
          enum: ["preference", "todo", "fact", "reminder"],
          description: "Category of memory",
        },
      },
      required: ["key", "value", "category"],
    },
  },
  {
    name: "delete_memory",
    description: "Delete a previously saved memory fact by key.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "The key of the fact to delete" },
      },
      required: ["key"],
    },
  },
  {
    name: "get_weather",
    description: "Get the current weather for a location.",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name, e.g. 'London' or 'New York, US'" },
      },
      required: ["location"],
    },
  },
  {
    name: "web_search",
    description: "Search the web for up-to-date information.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_calendar_events",
    description: "Get upcoming events from the user's Google Calendar.",
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date to fetch events for (YYYY-MM-DD). Defaults to today if omitted.",
        },
        days: {
          type: "number",
          description: "Number of days to look ahead (1–7). Defaults to 1.",
        },
      },
      required: [],
    },
  },
  {
    name: "send_slack_message",
    description: "Send a message to the team Slack channel.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The message text to send" },
      },
      required: ["message"],
    },
  },
  {
    name: "search_drive",
    description: "Search the user's Google Drive for files by name or content.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query, e.g. 'Q4 budget' or 'meeting notes'" },
      },
      required: ["query"],
    },
  },
  {
    name: "find_flights",
    description: "Search for flights between two cities on a given date.",
    input_schema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Departure city or airport code, e.g. 'London' or 'LHR'" },
        destination: { type: "string", description: "Arrival city or airport code, e.g. 'New York' or 'JFK'" },
        date: { type: "string", description: "Travel date (YYYY-MM-DD or natural language like 'next Friday')" },
        cabin: { type: "string", description: "Cabin class: economy, business, or first. Defaults to economy." },
      },
      required: ["origin", "destination", "date"],
    },
  },
];

async function executeTool(
  name: string,
  input: Record<string, string | number>,
  userId: string,
  accessToken?: string
): Promise<string> {
  if (name === "save_memory") {
    await upsertFact(userId, {
      key: input.key as string,
      value: input.value as string,
      category: input.category as "preference" | "todo" | "fact" | "reminder",
    });
    return `Saved: ${input.key} = ${input.value}`;
  }

  if (name === "delete_memory") {
    await deleteFact(userId, input.key as string);
    return `Deleted memory: ${input.key}`;
  }

  if (name === "get_weather") {
    const location = encodeURIComponent(input.location as string);
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${process.env.OPENWEATHER_API_KEY}&units=imperial`
    );
    const data = await res.json();
    if (data.cod !== 200) return `Could not get weather for ${input.location}`;
    const temp_f = Math.round(data.main.temp);
    const temp_c = Math.round((data.main.temp - 32) * (5 / 9));
    return `${data.name}, ${data.sys.country}: ${temp_f}°F (${temp_c}°C), ${data.weather[0].description}, humidity ${data.main.humidity}%, wind ${Math.round(data.wind.speed)} mph`;
  }

  if (name === "web_search") {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: input.query,
        search_depth: "advanced",
        max_results: 4,
        include_answer: true,
      }),
    });
    if (!res.ok) return "Search failed";
    const data = await res.json();
    const results: Array<{ title: string; content: string; url: string }> = data.results ?? [];
    if (!results.length) return "No results found";
    const lines = results
      .slice(0, 4)
      .map((r) => `[${r.title}](${r.url}): ${r.content.slice(0, 300)}`);
    if (data.answer) lines.unshift(`Summary: ${data.answer}`);
    return lines.join("\n\n");
  }

  if (name === "get_calendar_events") {
    if (!accessToken) return "Calendar access not available. Please sign out and sign in again to grant calendar permissions.";
    const targetDate = input.date ? new Date(input.date as string) : new Date();
    const days = Math.min(Math.max(Number(input.days ?? 1), 1), 7);
    const timeMin = new Date(targetDate);
    timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date(timeMin);
    timeMax.setDate(timeMax.getDate() + days);

    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("timeMin", timeMin.toISOString());
    url.searchParams.set("timeMax", timeMax.toISOString());
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "10");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const reason = errBody?.error?.message ?? errBody?.error ?? res.statusText ?? res.status;
      console.error("[calendar] Google API error:", res.status, JSON.stringify(errBody));
      return `Calendar error (${res.status}): ${reason}`;
    }
    const data = await res.json();
    const items: Array<{ summary?: string; start?: { dateTime?: string; date?: string } }> = data.items ?? [];
    if (items.length === 0) return "No events found for that period.";
    return items
      .map((e) => {
        const time = e.start?.dateTime
          ? new Date(e.start.dateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          : "All day";
        return `${time}: ${e.summary ?? "Untitled"}`;
      })
      .join("\n");
  }

  if (name === "send_slack_message") {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return "Slack is not configured.";
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.message }),
    });
    return res.ok ? "Message sent to Slack." : "Failed to send Slack message.";
  }

  if (name === "search_drive") {
    if (!accessToken) return "Google Drive access not available. Please sign out and sign in again.";
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `fullText contains '${(input.query as string).replace(/'/g, "\\'")}'`);
    url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime,webViewLink)");
    url.searchParams.set("pageSize", "5");
    url.searchParams.set("orderBy", "modifiedTime desc");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return "Could not search Google Drive. Your session may need to be refreshed.";
    const data = await res.json();
    const files: Array<{ name: string; mimeType: string; modifiedTime: string; webViewLink: string }> = data.files ?? [];
    if (!files.length) return `No files found in Google Drive matching "${input.query}".`;
    return files
      .map((f) => {
        const type = f.mimeType.includes("folder") ? "Folder" : f.mimeType.split(".").pop() ?? "File";
        const modified = new Date(f.modifiedTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        return `${f.name} (${type}, modified ${modified}) — ${f.webViewLink}`;
      })
      .join("\n");
  }

  if (name === "find_flights") {
    const cabin = (input.cabin as string | undefined) ?? "economy";
    const query = `${cabin} class flights from ${input.origin} to ${input.destination} on ${input.date} prices availability booking`;
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        max_results: 4,
        include_answer: true,
      }),
    });
    if (!res.ok) return "Flight search failed.";
    const data = await res.json();
    const results: Array<{ title: string; content: string; url: string }> = data.results ?? [];
    if (!results.length) return "No flight results found.";
    const lines = results
      .slice(0, 4)
      .map((r) => `[${r.title}](${r.url}): ${r.content.slice(0, 300)}`);
    if (data.answer) lines.unshift(`Summary: ${data.answer}`);
    return lines.join("\n\n");
  }

  return "Unknown tool";
}

/** Quick Llama Guard safety check. Returns true if safe to proceed. */
async function isSafe(text: string): Promise<boolean> {
  try {
    const result = await groq.chat.completions.create({
      model: "llama-guard-3-8b",
      messages: [{ role: "user", content: text }],
      max_tokens: 10,
    });
    const verdict = result.choices[0]?.message?.content?.trim() ?? "safe";
    return !verdict.toLowerCase().startsWith("unsafe");
  } catch {
    return true; // Fail open — don't block on guard errors
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { text, language, imageBase64, imageMimeType } = await req.json();
  if (!text) return Response.json({ error: "No text" }, { status: 400 });

  const userId = session.user.id;
  const accessToken = session.accessToken;

  // Llama Guard safety check
  const safe = await isSafe(text);
  if (!safe) {
    const encoder = new TextEncoder();
    const refusal = "I'm not able to help with that. Is there something else I can assist you with?";
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", delta: refusal })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  const [history, facts] = await Promise.all([getConversationHistory(userId), getUserFacts(userId)]);

  const memoryContext = buildMemoryContext(facts);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const langInstruction = language && language !== "en"
    ? `\nThe user is speaking ${language}. Respond in the same language.`
    : "";

  const systemPrompt = `You are Sarjy, a sharp and personal AI voice assistant. You have a warm but efficient personality — smart, helpful, and brief.

Today is ${today}.${memoryContext ? `\n\n${memoryContext}` : ""}${langInstruction}

Important:
- Keep responses concise for voice — 1–3 sentences unless the user asks for detail.
- When you learn something worth remembering (name, preference, todo, important fact), use save_memory.
- Always respond in plain text — no markdown, no bullet points.
- When answering from web_search results, only report facts explicitly stated in the results. Never add details from your training data.
- Never narrate a tool call before executing it. Do not say things like "Let me check…" or "I'll send that now…" — just call the tool silently and report the result.
- Always use the data returned by tools in your answer. Never claim you lack information that was returned in a tool result — if a tool returned URLs, file names, links, or any data, include them directly in your response.
- Do not discuss violence, illegal activities, explicit content, or competitor AI products. If asked, politely decline.

Workflows — follow these exactly when triggered:

PERSONALITY ASSESSMENT: When the user says "personality assessment", "what's my personality", or similar:
Guide them through exactly 5 questions, one at a time. Wait for their answer before asking the next.
Q1: How do you recharge — alone or with people?
Q2: Do you prefer plans or going with the flow?
Q3: When making decisions, do you lead with logic or feelings?
Q4: Do you prefer finishing tasks early or working close to deadlines?
Q5: What's your biggest strength in a team setting?
After Q5, summarize their likely MBTI type in 1–2 sentences and save it with save_memory(key="personality_type", value="...", category="fact").

SYMPTOM INTAKE: When the user describes health symptoms or says "I'm not feeling well":
Conduct a structured intake in this order — ask one question at a time:
1. Chief complaint (what's the main symptom?)
2. Duration (how long have you had it?)
3. Severity (rate 1–10)
4. Associated symptoms (anything else going on?)
After step 4, give a brief summary and remind them to consult a doctor for medical advice.
Save key findings with save_memory.`;

  // Build user content — plain text, or [image, text] for vision requests
  const userContent: Anthropic.MessageParam["content"] = imageBase64
    ? [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: (imageMimeType ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: imageBase64,
          },
        },
        { type: "text", text },
      ]
    : text;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content } as Anthropic.MessageParam)),
    { role: "user", content: userContent },
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(obj: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      try {
        let fullText = "";
        let continueLoop = true;
        let currentMessages = messages;

        while (continueLoop) {
          continueLoop = false;
          const pendingToolUses: Anthropic.ToolUseBlock[] = [];

          const response = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system: systemPrompt,
            tools: TOOLS,
            messages: currentMessages,
            stream: true,
          });

          let currentToolName = "";
          let currentToolId = "";
          let currentToolInput = "";

          for await (const event of response) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "tool_use") {
                currentToolName = event.content_block.name;
                currentToolId = event.content_block.id;
                currentToolInput = "";
                emit({ type: "tool_start", name: currentToolName });
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                fullText += event.delta.text;
                emit({ type: "text", delta: event.delta.text });
              } else if (event.delta.type === "input_json_delta") {
                currentToolInput += event.delta.partial_json;
              }
            } else if (event.type === "content_block_stop") {
              if (currentToolName) {
                pendingToolUses.push({
                  type: "tool_use",
                  id: currentToolId,
                  name: currentToolName,
                  input: JSON.parse(currentToolInput || "{}"),
                });
                currentToolName = "";
                currentToolId = "";
                currentToolInput = "";
              }
            } else if (event.type === "message_stop") {
              if (pendingToolUses.length > 0) {
                continueLoop = true;

                const toolResults: Anthropic.ToolResultBlockParam[] = [];
                for (const tool of pendingToolUses) {
                  const result = await executeTool(
                    tool.name,
                    tool.input as Record<string, string | number>,
                    userId,
                    accessToken
                  );
                  emit({ type: "tool_result", name: tool.name, result });
                  toolResults.push({ type: "tool_result", tool_use_id: tool.id, content: result });
                }

                const assistantContent: Anthropic.ContentBlock[] = [];
                if (fullText) assistantContent.push({ type: "text", text: fullText } as Anthropic.ContentBlock);
                assistantContent.push(...pendingToolUses);

                currentMessages = [
                  ...currentMessages,
                  { role: "assistant", content: assistantContent },
                  { role: "user", content: toolResults },
                ];
                fullText = "";
              }
            }
          }
        }

        emit({ type: "done" });
        controller.close();

        await Promise.all([
          appendMessage(userId, { role: "user", content: text, timestamp: Date.now() }),
          ...(fullText
            ? [appendMessage(userId, { role: "assistant", content: fullText, timestamp: Date.now() })]
            : []),
        ]);
      } catch (err) {
        emit({ type: "error", message: String(err) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

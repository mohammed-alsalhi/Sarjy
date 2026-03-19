import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CONVERSATION_TTL = 60 * 60 * 24; // 24 hours

export type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

export async function getConversationHistory(userId: string): Promise<Message[]> {
  const key = `conv:${userId}`;
  const raw = await redis.get<Message[]>(key);
  return raw ?? [];
}

export async function appendMessage(userId: string, message: Message): Promise<void> {
  const key = `conv:${userId}`;
  const history = await getConversationHistory(userId);
  const updated = [...history, message].slice(-40); // keep last 40 messages
  await redis.set(key, updated, { ex: CONVERSATION_TTL });
}

export async function clearConversation(userId: string): Promise<void> {
  await redis.del(`conv:${userId}`);
}

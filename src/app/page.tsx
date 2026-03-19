import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignInCard } from "@/components/SignInCard";
import { VoiceAssistant } from "@/components/VoiceAssistant";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) return <SignInCard />;

  return <VoiceAssistant />;
}

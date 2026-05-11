import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import ChallengeWorkspace from "@/components/legal-arena/ChallengeWorkspace";
import DevelopmentAccessGate from "@/components/legal-arena/DevelopmentAccessGate";
import {
  getChallengeForUser,
  viewerCanOpenChallenge,
} from "@/libs/game/challenges";
import { userCanAccessArena } from "@/libs/admin";
import { toClientJSON } from "@/libs/serialize";

export const dynamic = "force-dynamic";

export default async function ChallengePage({ params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return <DevelopmentAccessGate email={session?.user?.email || ""} />;
  }

  const hasArenaAccess = await userCanAccessArena(session);
  const canOpenSponsoredChallenge =
    hasArenaAccess ||
    (await viewerCanOpenChallenge({
      userId: session.user.id,
      challengeId: params.challengeId,
    }));

  if (!canOpenSponsoredChallenge) {
    return <DevelopmentAccessGate email={session.user?.email || ""} />;
  }

  const challenge = await getChallengeForUser({
    userId: session.user.id,
    challengeId: params.challengeId,
  });

  if (!challenge) {
    notFound();
  }

  return <ChallengeWorkspace initialChallenge={toClientJSON(challenge)} />;
}

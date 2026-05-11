import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import DevelopmentAccessGate from "@/components/legal-arena/DevelopmentAccessGate";
import PlayerProfileDossier from "@/components/legal-arena/PlayerProfileDossier";
import { userCanAccessArena } from "@/libs/admin";
import { getPublicPlayerProfile, listScenarioOptions } from "@/libs/game/store";
import { toClientJSON } from "@/libs/serialize";

export const dynamic = "force-dynamic";

export default async function PlayerProfilePage({ params }) {
  const session = await getServerSession(authOptions);

  const hasArenaAccess = await userCanAccessArena(session);

  if (!hasArenaAccess) {
    return <DevelopmentAccessGate email={session?.user?.email || ""} />;
  }

  const [profile, challengeTemplates] = await Promise.all([
    getPublicPlayerProfile(params.playerId),
    listScenarioOptions(session.user.id, session.user),
  ]);

  if (!profile) {
    notFound();
  }

  return (
    <PlayerProfileDossier
      profile={toClientJSON(profile)}
      viewerUserId={session.user.id}
      challengeTemplates={toClientJSON(challengeTemplates)}
      hasArenaAccess={hasArenaAccess}
    />
  );
}

import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import PlayerProfileDossier from "@/components/legal-arena/PlayerProfileDossier";
import { isAdminEmail, userCanAccessArena } from "@/libs/admin";
import { getPublicPlayerProfile, listScenarioOptions } from "@/libs/game/store";
import { toClientJSON } from "@/libs/serialize";

export const dynamic = "force-dynamic";

export default async function PlayerProfilePage({ params }) {
  const session = await getServerSession(authOptions);

  const hasArenaAccess = await userCanAccessArena(session);
  const isAdmin = isAdminEmail(session?.user?.email);
  const canViewFullArchive = isAdmin || String(session?.user?.id || "") === String(params.playerId);

  const [profile, challengeTemplates] = await Promise.all([
    getPublicPlayerProfile(params.playerId, { canViewFullArchive }),
    hasArenaAccess ? listScenarioOptions(session.user.id, session.user) : Promise.resolve([]),
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
      isAdmin={isAdmin}
    />
  );
}

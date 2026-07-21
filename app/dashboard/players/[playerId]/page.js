import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { authOptions } from "@/libs/next-auth";
import PlayerProfileDossier from "@/components/legal-arena/PlayerProfileDossier";
import { isAdminEmail, userCanAccessArena } from "@/libs/admin";
import { getPublicPlayerProfile, listScenarioOptions } from "@/libs/game/store";
import { toClientJSON } from "@/libs/serialize";
import { resolveCountryDetectionFromHeaders } from "@/libs/game/countries";
import { getPlayerCaseCountryPreference } from "@/libs/game/countryPreference";
import { recordProfileView } from "@/libs/game/profileViews";

export const dynamic = "force-dynamic";

export default async function PlayerProfilePage({ params }) {
  const session = await getServerSession(authOptions);
  const countryDetection = resolveCountryDetectionFromHeaders(headers());

  const hasArenaAccess = await userCanAccessArena(session);
  const isAdmin = isAdminEmail(session?.user?.email);
  const canViewFullArchive = isAdmin || String(session?.user?.id || "") === String(params.playerId);

  const [profile, challengeTemplates, preferredCountryCode] = await Promise.all([
    getPublicPlayerProfile(params.playerId, { canViewFullArchive }),
    hasArenaAccess ? listScenarioOptions(session.user.id, session.user) : Promise.resolve([]),
    getPlayerCaseCountryPreference(session.user.id),
  ]);

  if (!profile) {
    notFound();
  }

  try {
    await recordProfileView({
      profileUserId: params.playerId,
      viewerUserId: session.user.id,
    });
  } catch (error) {
    console.error("Could not record player profile view.", error);
  }

  return (
    <PlayerProfileDossier
      profile={toClientJSON(profile)}
      viewerUserId={session.user.id}
      challengeTemplates={toClientJSON(challengeTemplates)}
      hasArenaAccess={hasArenaAccess}
      isAdmin={isAdmin}
      detectedCountryCode={preferredCountryCode || countryDetection.countryCode}
      detectedCountrySource={preferredCountryCode ? "profile" : countryDetection.source}
    />
  );
}

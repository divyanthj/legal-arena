import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import DevelopmentAccessGate from "@/components/legal-arena/DevelopmentAccessGate";
import PlayerMatterDossier from "@/components/legal-arena/PlayerMatterDossier";
import { findMatterById } from "@/components/legal-arena/playerDossierShared";
import { isAdminEmail, userCanAccessArena } from "@/libs/admin";
import { getPublicPlayerProfile } from "@/libs/game/store";
import { toClientJSON } from "@/libs/serialize";

export const dynamic = "force-dynamic";

export default async function PlayerMatterPage({ params }) {
  const session = await getServerSession(authOptions);
  const hasArenaAccess = await userCanAccessArena(session);
  const isAdmin = isAdminEmail(session?.user?.email);
  const canViewFullArchive = isAdmin || String(session?.user?.id || "") === String(params.playerId);

  if (!hasArenaAccess) {
    return <DevelopmentAccessGate email={session?.user?.email || ""} />;
  }

  const profile = await getPublicPlayerProfile(params.playerId, { canViewFullArchive });

  if (!profile) {
    notFound();
  }

  const matter = findMatterById(profile.cases, params.matterId);

  if (!matter) {
    notFound();
  }

  return (
    <PlayerMatterDossier
      player={toClientJSON(profile.player)}
      caseSession={toClientJSON(matter)}
    />
  );
}

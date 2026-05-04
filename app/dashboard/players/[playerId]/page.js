import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import DevelopmentAccessGate from "@/components/legal-arena/DevelopmentAccessGate";
import PlayerProfileDossier from "@/components/legal-arena/PlayerProfileDossier";
import { userCanAccessArena } from "@/libs/admin";
import { getPublicPlayerProfile } from "@/libs/game/store";
import { toClientJSON } from "@/libs/serialize";

export const dynamic = "force-dynamic";

export default async function PlayerProfilePage({ params }) {
  const session = await getServerSession(authOptions);

  if (!(await userCanAccessArena(session))) {
    return <DevelopmentAccessGate email={session.user?.email || ""} />;
  }

  const profile = await getPublicPlayerProfile(params.playerId);

  if (!profile) {
    notFound();
  }

  return (
    <PlayerProfileDossier
      profile={toClientJSON(profile)}
      viewerUserId={session.user.id}
    />
  );
}

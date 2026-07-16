import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import BarAssociationDirectory from "@/components/legal-arena/BarAssociationDirectory";
import { listPlayerDirectory } from "@/libs/game/progression";
import { toClientJSON } from "@/libs/serialize";
import { isAdminEmail } from "@/libs/admin";
import { getAdminNudgeDirectoryData } from "@/libs/adminNudges";

export const dynamic = "force-dynamic";

export default async function BarAssociationPage() {
  const session = await getServerSession(authOptions);

  const players = await listPlayerDirectory();
  const isAdmin = isAdminEmail(session.user?.email);
  const nudgeDirectoryData = isAdmin
    ? await getAdminNudgeDirectoryData(players.map((player) => player.id))
    : { eligiblePlayerIds: new Set(), lastNudgeByPlayerId: {} };
  const clientPlayers = players.map((player) => ({
    ...toClientJSON(player),
    canReceiveAdminNudge: nudgeDirectoryData.eligiblePlayerIds.has(String(player.id)),
    lastNudge: nudgeDirectoryData.lastNudgeByPlayerId[String(player.id)] || null,
  }));

  return (
    <BarAssociationDirectory
      players={clientPlayers}
      viewerUserId={session.user.id}
      viewerName={session.user?.name || session.user?.email || "Counsel"}
      isAdmin={isAdmin}
    />
  );
}

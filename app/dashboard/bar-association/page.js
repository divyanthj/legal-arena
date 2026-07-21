import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import BarAssociationDirectory from "@/components/legal-arena/BarAssociationDirectory";
import { listPlayerDirectory } from "@/libs/game/progression";
import { toClientJSON } from "@/libs/serialize";
import { isAdminEmail } from "@/libs/admin";
import { getAdminNudgeDirectoryData } from "@/libs/adminNudges";
import { listRecentProfileViews } from "@/libs/game/profileViews";

export const dynamic = "force-dynamic";

export default async function BarAssociationPage() {
  const session = await getServerSession(authOptions);

  const [players, recentViews] = await Promise.all([
    listPlayerDirectory(),
    listRecentProfileViews(session.user.id, { limit: 6 }),
  ]);
  const isAdmin = isAdminEmail(session.user?.email);
  const nudgeDirectoryData = isAdmin
    ? await getAdminNudgeDirectoryData(players.map((player) => player.id))
    : { eligiblePlayerIds: new Set(), lastNudgeByPlayerId: {} };
  const clientPlayers = players.map((player) => ({
    ...toClientJSON(player),
    canReceiveAdminNudge: nudgeDirectoryData.eligiblePlayerIds.has(String(player.id)),
    lastNudge: nudgeDirectoryData.lastNudgeByPlayerId[String(player.id)] || null,
  }));
  const playersById = new Map(clientPlayers.map((player) => [String(player.id), player]));
  const recentProfileViewers = recentViews
    .map((view) => {
      const player = playersById.get(String(view.viewerUserId));
      return player ? { ...player, viewedAt: view.viewedAt } : null;
    })
    .filter(Boolean);

  return (
    <BarAssociationDirectory
      players={clientPlayers}
      viewerUserId={session.user.id}
      viewerName={session.user?.name || session.user?.email || "Counsel"}
      recentProfileViewers={toClientJSON(recentProfileViewers)}
      isAdmin={isAdmin}
    />
  );
}

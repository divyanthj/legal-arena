import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import BarAssociationDirectory from "@/components/legal-arena/BarAssociationDirectory";
import { listPlayerDirectory } from "@/libs/game/progression";
import { toClientJSON } from "@/libs/serialize";

export const dynamic = "force-dynamic";

export default async function BarAssociationPage() {
  const session = await getServerSession(authOptions);

  const players = await listPlayerDirectory();

  return (
    <BarAssociationDirectory
      players={toClientJSON(players)}
      viewerUserId={session.user.id}
      viewerName={session.user?.name || session.user?.email || "Counsel"}
    />
  );
}

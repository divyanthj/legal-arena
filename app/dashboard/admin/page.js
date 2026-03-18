import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import AdminCaseLab from "@/components/legal-arena/AdminCaseLab";
import connectMongo from "@/libs/mongoose";
import CaseTemplate from "@/models/CaseTemplate";
import CaseSession from "@/models/CaseSession";
import { getAdminEmails, isAdminEmail } from "@/libs/admin";
import { listCategoryOptions } from "@/libs/game/templates";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=%2Fdashboard%2Fadmin");
  }

  if (!isAdminEmail(session.user.email)) {
    redirect("/dashboard");
  }

  await connectMongo();

  const [templates, templateStats] = await Promise.all([
    CaseTemplate.find({}).sort({ updatedAt: -1 }),
    CaseSession.aggregate([
      {
        $group: {
          _id: "$caseTemplateId",
          plays: { $sum: 1 },
          wins: {
            $sum: {
              $cond: [{ $eq: ["$verdict.winner", "player"] }, 1, 0],
            },
          },
          losses: {
            $sum: {
              $cond: [{ $eq: ["$verdict.winner", "opponent"] }, 1, 0],
            },
          },
          draws: {
            $sum: {
              $cond: [{ $eq: ["$verdict.winner", "draw"] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const statsByTemplateId = new Map(
    templateStats.map((entry) => [String(entry._id), entry])
  );

  const templatesWithStats = templates.map((template) => {
    const stats = statsByTemplateId.get(String(template._id));

    return {
      ...template.toJSON(),
      plays: stats?.plays || 0,
      wins: stats?.wins || 0,
      losses: stats?.losses || 0,
      draws: stats?.draws || 0,
    };
  });

  return (
    <AdminCaseLab
      categories={listCategoryOptions()}
      initialTemplates={templatesWithStats}
      adminEmails={getAdminEmails()}
    />
  );
}

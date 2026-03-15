import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import AdminCaseLab from "@/components/legal-arena/AdminCaseLab";
import connectMongo from "@/libs/mongoose";
import CaseTemplate from "@/models/CaseTemplate";
import { getAdminEmails, isAdminEmail } from "@/libs/admin";
import { listCategoryOptions, ensureSeedCaseTemplates } from "@/libs/game/templates";

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
  await ensureSeedCaseTemplates();

  const templates = await CaseTemplate.find({}).sort({ updatedAt: -1 });

  return (
    <AdminCaseLab
      categories={listCategoryOptions()}
      initialTemplates={templates.map((template) => template.toJSON())}
      adminEmails={getAdminEmails()}
    />
  );
}


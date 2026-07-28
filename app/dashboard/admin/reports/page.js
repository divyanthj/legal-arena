import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { isAdminEmail } from "@/libs/admin";
import connectMongo from "@/libs/mongoose";
import ContentReport from "@/models/ContentReport";
import ModerationQueue from "@/components/legal-arena/ModerationQueue";
import { toClientJSON } from "@/libs/serialize";

export const dynamic = "force-dynamic";

export default async function ModerationReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin?callbackUrl=/dashboard/admin/reports");
  if (!isAdminEmail(session.user.email)) notFound();

  await connectMongo();
  const reports = await ContentReport.find({})
    .select("+reporterUserId +reportedUserId +contentExcerpt +details")
    .populate("reporterUserId", "name")
    .populate("reportedUserId", "name")
    .sort({ status: 1, createdAt: -1 })
    .limit(200)
    .lean();

  const queue = reports.map((report) => ({
    ...toClientJSON(report),
    reporterName: report.reporterUserId?.name || "",
    reportedName: report.reportedUserId?.name || "",
    reporterUserId: undefined,
    reportedUserId: undefined,
  }));

  return (
    <main className="arena-app-shell min-h-screen px-4 py-6 text-white md:px-8 md:py-10">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="arena-kicker">Admin safety</p>
            <h1 className="arena-headline mt-3 text-4xl uppercase md:text-6xl">Moderation queue</h1>
            <p className="mt-3 text-sm text-white/55">Up to 200 recent AI and PVP reports.</p>
          </div>
          <Link href="/dashboard/admin" className="arena-btn-dark px-4 py-2 text-sm">
            Back to admin
          </Link>
        </div>
        <div className="mt-8">
          <ModerationQueue initialReports={queue} />
        </div>
      </section>
    </main>
  );
}


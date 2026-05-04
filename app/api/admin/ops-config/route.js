import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { getAdminOpsConfig, upsertAdminOpsConfig } from "@/libs/adminOps";
import { isAdminEmail } from "@/libs/admin";
import connectMongo from "@/libs/mongoose";
import EmailNudgeLog from "@/models/EmailNudgeLog";

const DAY_MS = 24 * 60 * 60 * 1000;

const assertAdmin = async () => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    throw new Error("FORBIDDEN");
  }

  return session;
};

export async function GET() {
  try {
    await assertAdmin();
    await connectMongo();

    const [config, recentNudges] = await Promise.all([
      getAdminOpsConfig(),
      EmailNudgeLog.aggregate([
        {
          $match: {
            sentAt: {
              $gte: new Date(Date.now() - 14 * DAY_MS),
            },
          },
        },
        {
          $group: {
            _id: "$nudgeType",
            sentCount: { $sum: 1 },
            latestSentAt: { $max: "$sentAt" },
          },
        },
        { $sort: { sentCount: -1 } },
      ]),
    ]);

    return NextResponse.json({
      config,
      recentNudges,
    });
  } catch (error) {
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(
      { error: error.message || "Failed to load admin ops config." },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    await assertAdmin();

    const body = await req.json();
    const config = await upsertAdminOpsConfig({
      retention: body.retention,
      digest: body.digest,
    });

    return NextResponse.json({ config });
  } catch (error) {
    if (error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(
      { error: error.message || "Failed to save admin ops config." },
      { status: 500 }
    );
  }
}

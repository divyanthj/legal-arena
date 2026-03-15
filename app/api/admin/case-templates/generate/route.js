import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import { hasValidCaseGeneratorApiKey, isAdminEmail } from "@/libs/admin";
import { createGeneratedCaseTemplate } from "@/libs/game/generation";
import { DEFAULT_CATEGORY_SLUG } from "@/libs/game/categories";

const isAuthorized = ({ req, session }) =>
  hasValidCaseGeneratorApiKey(req) || isAdminEmail(session?.user?.email);

export async function POST(req) {
  const session = await getServerSession(authOptions);

  if (!isAuthorized({ req, session })) {
    return NextResponse.json(
      { error: "Admin session or valid case generator API key required" },
      { status: 403 }
    );
  }

  try {
    await connectMongo();
    const body = await req.json();
    const template = await createGeneratedCaseTemplate({
      categorySlug: body?.primaryCategory || DEFAULT_CATEGORY_SLUG,
      complexity: Number(body?.complexity || 2),
      prompt: body?.prompt || "",
      userId: session?.user?.id || "api-generator",
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

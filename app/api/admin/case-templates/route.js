import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import CaseTemplate from "@/models/CaseTemplate";
import CaseSession from "@/models/CaseSession";
import { isAdminEmail } from "@/libs/admin";
import { validateCaseTemplatePayload } from "@/libs/game/templates";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    await connectMongo();

    const templates = await CaseTemplate.find({}).sort({ updatedAt: -1 });
    return NextResponse.json({ templates });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    await connectMongo();
    const body = await req.json();
    const errors = validateCaseTemplatePayload(body);

    if (errors.length > 0) {
      return NextResponse.json(
        { error: `Invalid case template: ${errors.join(", ")}` },
        { status: 400 }
      );
    }

    const slug =
      body.slug?.trim() ||
      `${Date.now()}-${body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    const template = await CaseTemplate.create({
      ...body,
      slug,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    await connectMongo();
    const body = await req.json();
    const templateId = body?.id?.trim();

    if (!templateId) {
      return NextResponse.json({ error: "Template id is required" }, { status: 400 });
    }

    const errors = validateCaseTemplatePayload(body);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: `Invalid case template: ${errors.join(", ")}` },
        { status: 400 }
      );
    }

    const template = await CaseTemplate.findByIdAndUpdate(
      templateId,
      {
        ...body,
      },
      { new: true, runValidators: true }
    );

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    await connectMongo();
    const body = await req.json();
    const templateId = body?.id?.trim();

    if (!templateId) {
      return NextResponse.json({ error: "Template id is required" }, { status: 400 });
    }

    const template = await CaseTemplate.findById(templateId);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await Promise.all([
      CaseSession.deleteMany({ caseTemplateId: template._id }),
      CaseTemplate.deleteOne({ _id: template._id }),
    ]);

    return NextResponse.json({ success: true, deletedTemplateId: templateId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

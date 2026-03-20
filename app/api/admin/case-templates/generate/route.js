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
    const wantsStream = Boolean(body?.stream);
    const options = {
      categorySlug: body?.primaryCategory || DEFAULT_CATEGORY_SLUG,
      complexity: Number(body?.complexity || 2),
      prompt: body?.prompt || "",
      userId: session?.user?.id || "api-generator",
    };

    if (!wantsStream) {
      const template = await createGeneratedCaseTemplate(options);
      return NextResponse.json({ template }, { status: 201 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event, payload) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        };

        try {
          send("start", { ok: true });

          const template = await createGeneratedCaseTemplate({
            ...options,
            onProgress: async (progress) => {
              console.log("[case-generator]", progress.stage, progress.result);
              send("stage", progress);
            },
          });

          send("complete", { template });
          controller.close();
        } catch (error) {
          console.error(error);
          send("error", { error: error.message || "Generation failed" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

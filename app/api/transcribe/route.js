import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/libs/next-auth";
import { userCanAccessArena } from "@/libs/admin";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(req) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!(await userCanAccessArena(session))) {
    return NextResponse.json(
      { error: "Legal Arena is still in development. Access is currently limited." },
      { status: 403 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!audio || typeof audio === "string") {
      return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Audio is too large. Please keep recordings under 25 MB." },
        { status: 413 }
      );
    }

    const upstreamForm = new FormData();
    upstreamForm.append("file", audio, audio.name || "question.webm");
    upstreamForm.append("model", "whisper-1");
    upstreamForm.append("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: upstreamForm,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("OpenAI transcription error:", response.status, errorBody);

      return NextResponse.json(
        { error: "Could not transcribe the recording." },
        { status: response.status }
      );
    }

    const payload = await response.json();

    return NextResponse.json({ text: String(payload.text || "").trim() });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

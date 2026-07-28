import { NextResponse } from "next/server";
import { getAndroidRelease } from "@/libs/appRelease";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getAndroidRelease(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}


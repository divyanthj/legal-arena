import { NextResponse } from "next/server";
import { ANDROID_PACKAGE_ID } from "@/libs/appRelease";

const normalizeFingerprint = (value = "") => {
  const compact = String(value || "")
    .trim()
    .replace(/[^a-fA-F0-9]/g, "")
    .toUpperCase();

  if (!/^[A-F0-9]{64}$/.test(compact)) return "";
  return compact.match(/.{2}/g).join(":");
};

export function GET() {
  const fingerprints = String(process.env.ANDROID_SIGNING_SHA256 || "")
    .split(",")
    .map(normalizeFingerprint)
    .filter(Boolean);

  const statements = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: ANDROID_PACKAGE_ID,
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ]
    : [];

  return NextResponse.json(statements, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}


import { NextResponse } from "next/server";
import { getRequestSession } from "@/libs/api-auth";
import { deleteAccountForUser } from "@/libs/accountDeletion";

export async function DELETE(req) {
  const { session, authType, error: authError } = await getRequestSession(req);
  if (authError) return authError;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (authType !== "nextauth") {
    return NextResponse.json(
      { error: "Account deletion must be confirmed through the signed-in web account." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  if (String(body?.confirmation || "").trim().toUpperCase() !== "DELETE") {
    return NextResponse.json(
      { error: "Type DELETE to confirm permanent account deletion." },
      { status: 400 }
    );
  }

  const result = await deleteAccountForUser(session.user.id);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import * as HeroIcons from "@heroicons/react/24/outline";
import apiClient from "@/libs/api";

export default function CommunityTermsAcceptance({ alreadyAccepted = false }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accepted, setAccepted] = useState(alreadyAccepted);
  const [saving, setSaving] = useState(false);
  const nextPath = searchParams.get("next");
  const safeNext = nextPath?.startsWith("/dashboard") ? nextPath : "/dashboard";

  const submit = async () => {
    setSaving(true);
    try {
      await apiClient.post("/community-terms", { accepted: true });
      setAccepted(true);
      toast.success("Community Rules accepted.");
      router.push(safeNext);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  if (accepted) {
    return (
      <div className="rounded-2xl border border-emerald-200/20 bg-emerald-200/[0.07] p-5 text-sm text-emerald-50/80">
        <div className="flex items-center gap-2 font-bold text-emerald-100">
          <HeroIcons.CheckCircleIcon className="h-5 w-5" />
          Community Rules accepted
        </div>
        <button type="button" onClick={() => router.push(safeNext)} className="mt-4 underline">
          Continue to Legal Arena
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={saving}
      onClick={submit}
      className="arena-btn-light flex min-h-14 w-full items-center justify-center gap-3 px-6 py-3 text-sm font-black disabled:opacity-60"
    >
      {saving ? (
        <span className="loading loading-spinner loading-sm" />
      ) : (
        <HeroIcons.ShieldCheckIcon className="h-5 w-5" />
      )}
      I accept the Community Rules
    </button>
  );
}


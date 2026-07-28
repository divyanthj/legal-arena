"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "react-hot-toast";
import * as HeroIcons from "@heroicons/react/24/outline";

export default function AccountDeletionPanel() {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    if (confirmation.trim().toUpperCase() !== "DELETE") return;
    setDeleting(true);

    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Account deletion failed.");
      await signOut({ callbackUrl: "/?account=deleted" });
    } catch (error) {
      toast.error(error?.message || "Account deletion failed.");
      setDeleting(false);
    }
  };

  return (
    <section className="rounded-3xl border border-rose-300/20 bg-rose-500/[0.055] p-5 md:p-7">
      <div className="flex items-start gap-3">
        <HeroIcons.ExclamationTriangleIcon className="mt-1 h-6 w-6 shrink-0 text-rose-200" />
        <div>
          <h2 className="text-xl font-black text-white">Permanently delete account</h2>
          <p className="mt-3 text-sm leading-7 text-white/62">
            This removes your sign-in identity, profile, solo cases, awards, usage
            records, API credentials, and account-bound access. Shared PVP records are
            retained only as anonymized game history for the other participant. Published
            case reports involving you are unpublished.
          </p>
        </div>
      </div>
      <label className="mt-6 block">
        <span className="text-xs font-black uppercase tracking-[0.2em] text-rose-100/65">
          Type DELETE to confirm
        </span>
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="input arena-field mt-2 min-h-12 w-full text-white"
          autoComplete="off"
        />
      </label>
      <button
        type="button"
        disabled={deleting || confirmation.trim().toUpperCase() !== "DELETE"}
        onClick={deleteAccount}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-200/30 bg-rose-500/15 px-5 text-sm font-black text-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {deleting ? <span className="loading loading-spinner loading-sm" /> : null}
        Delete my Legal Arena account
      </button>
    </section>
  );
}


"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import * as HeroIcons from "@heroicons/react/24/outline";
import apiClient from "@/libs/api";

export default function AccountDeletionRequestForm() {
  const [form, setForm] = useState({ name: "", email: "", details: "" });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post("/contact", {
        name: form.name,
        email: form.email,
        source: "account_deletion_request",
        message: `Account deletion request. Verification details: ${
          form.details.trim() || "No additional details supplied."
        }`,
      });
      setSent(true);
      toast.success("Deletion request received.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200/20 bg-emerald-200/[0.07] p-5 text-sm leading-7 text-emerald-50/80">
        <HeroIcons.CheckCircleIcon className="mb-3 h-6 w-6 text-emerald-200" />
        Your request is in the support queue. We will use the supplied email to
        verify account ownership before deleting data.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-xs font-black uppercase tracking-[0.2em] text-white/42">Name</span>
        <input
          required
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          className="input arena-field mt-2 min-h-12 w-full text-white"
          maxLength={120}
        />
      </label>
      <label className="block">
        <span className="text-xs font-black uppercase tracking-[0.2em] text-white/42">Account email</span>
        <input
          required
          type="email"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          className="input arena-field mt-2 min-h-12 w-full text-white"
          maxLength={180}
        />
      </label>
      <label className="block">
        <span className="text-xs font-black uppercase tracking-[0.2em] text-white/42">Verification details (optional)</span>
        <textarea
          value={form.details}
          onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))}
          className="textarea arena-field mt-2 min-h-24 w-full text-white"
          maxLength={1200}
          placeholder="For example, the approximate date you created the account."
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="arena-btn-light flex min-h-12 w-full items-center justify-center gap-2 px-5 text-sm font-black disabled:opacity-60"
      >
        {submitting ? <span className="loading loading-spinner loading-sm" /> : null}
        Request account deletion
      </button>
    </form>
  );
}


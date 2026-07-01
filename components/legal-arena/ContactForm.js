"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import * as HeroIcons from "@heroicons/react/24/outline";
import apiClient from "@/libs/api";
import { trackGoal } from "@/libs/datafast";

const initialForm = {
  name: "",
  email: "",
  message: "",
};

export default function ContactForm() {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const updateField = (field) => (event) => {
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    trackGoal("contact_form_started", {
      source: "contact_page",
    });

    try {
      await apiClient.post("/contact", form);
      setSent(true);
      setForm(initialForm);
      toast.success("Message sent. We will get back to you soon.");
      trackGoal("contact_form_submitted", {
        source: "contact_page",
      });
    } catch (error) {
      trackGoal("contact_form_failed", {
        source: "contact_page",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="rounded-[1.75rem] border border-white/10 bg-[#090909]/92 p-5 shadow-2xl shadow-black/55 md:p-7"
      onSubmit={handleSubmit}
    >
      <div className="mb-6 border-b border-white/10 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-100/60">
          Direct Line
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          We will route it from here.
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/48">
            Name
          </span>
          <input
            required
            type="text"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={updateField("name")}
            className="input arena-field min-h-12 w-full text-white"
            placeholder="Your name"
            maxLength={120}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/48">
            Email
          </span>
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={updateField("email")}
            className="input arena-field min-h-12 w-full text-white"
            placeholder="you@example.com"
            maxLength={180}
          />
        </label>
      </div>

      <label className="mt-5 block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/48">
          Message
        </span>
        <textarea
          required
          name="message"
          value={form.message}
          onChange={updateField("message")}
          className="textarea arena-field min-h-44 w-full resize-y text-white"
          placeholder="Tell us what you need help with."
          minLength={10}
          maxLength={4000}
        />
      </label>

      <div className="mt-5 flex flex-col gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-amber-200/60 bg-[#fee88a] px-6 text-base font-bold text-black shadow-[0_18px_42px_rgba(245,158,11,0.16)] transition hover:bg-[#fff0a6] disabled:bg-[#fee88a]/70"
        >
          {isSubmitting ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <HeroIcons.PaperAirplaneIcon className="h-5 w-5" aria-hidden="true" />
          )}
          Send Message
        </button>
        {sent ? (
          <p className="text-center text-sm leading-6 text-emerald-100/78">
            Your message is in the queue.
          </p>
        ) : (
          <p className="text-center text-sm leading-6 text-white/45">
            We store your request so the team can respond.
          </p>
        )}
      </div>
    </form>
  );
}

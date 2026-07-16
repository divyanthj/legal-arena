"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import * as HeroIcons from "@heroicons/react/24/outline";
import {
  CASE_ASSEMBLY_STAGES,
  getCaseAssemblyStageState,
} from "@/libs/caseAssemblyCore.mjs";

const formatElapsed = (milliseconds = 0) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
};

const StatusMark = ({ state }) => {
  if (state === "complete") {
    return (
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-emerald-200/30 bg-emerald-200/15 text-emerald-200 shadow-[0_0_24px_rgba(110,231,183,0.12)]">
        <HeroIcons.CheckIcon className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  if (state === "active") {
    return (
      <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full border border-amber-200/40 bg-amber-200/10 text-amber-100 shadow-[0_0_28px_rgba(253,230,138,0.14)]">
        <span className="loading loading-ring loading-sm" aria-hidden="true" />
        <span className="absolute h-1.5 w-1.5 rounded-full bg-amber-100" />
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-error/35 bg-error/15 text-error">
        <HeroIcons.ExclamationCircleIcon className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/25">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
};

const PortraitStatus = ({ label, name, status = "queued", image = "" }) => {
  const failed = status === "failed";
  const complete = status === "complete";
  const generating = status === "generating";

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition duration-500 ${
        complete
          ? "border-emerald-200/20 bg-emerald-200/[0.06]"
          : failed
            ? "border-white/10 bg-white/[0.025]"
            : "border-amber-200/15 bg-amber-100/[0.045]"
      }`}
    >
      <div className="flex items-center gap-3 p-3.5">
        <div className="relative grid h-16 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/30 text-white/35">
          {complete && image ? (
            <Image
              src={image}
              alt=""
              fill
              sizes="56px"
              unoptimized
              className="object-cover object-top"
            />
          ) : failed ? (
            <HeroIcons.UserCircleIcon className="h-8 w-8" aria-hidden="true" />
          ) : (
            <>
              <HeroIcons.UserIcon className="h-7 w-7" aria-hidden="true" />
              {generating ? (
                <span className="absolute inset-0 animate-pulse bg-gradient-to-b from-transparent via-amber-100/10 to-transparent" />
              ) : null}
            </>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">{label}</p>
          <p className="mt-1 truncate text-sm font-bold text-white">{name || "Identity pending"}</p>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
            {complete ? (
              <>
                <HeroIcons.CheckCircleIcon className="h-4 w-4 text-emerald-200" aria-hidden="true" />
                <span className="text-emerald-100/75">Portrait ready</span>
              </>
            ) : failed ? (
              <>
                <HeroIcons.InformationCircleIcon className="h-4 w-4 text-white/45" aria-hidden="true" />
                <span className="text-white/55">Portrait unavailable — fallback ready</span>
              </>
            ) : generating ? (
              <>
                <span className="loading loading-spinner loading-xs text-amber-100" aria-hidden="true" />
                <span className="text-amber-100/75">Creating portrait</span>
              </>
            ) : (
              <span className="text-white/40">Queued</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function CaseAssemblyOverlay({ assembly, onRetry, onReturn }) {
  const [now, setNow] = useState(() => Date.now());
  const headingRef = useRef(null);
  const elapsedMs = Math.max(0, now - Number(assembly?.startedAt || now));
  const longWait = elapsedMs >= 120000;
  const preview = assembly?.casePreview || null;
  const portraits = assembly?.portraits || {};

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    headingRef.current?.focus();
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearInterval(intervalId);
    };
  }, []);

  const currentMessage = useMemo(() => {
    if (assembly.status === "error") {
      return "The case file could not be completed. Your selections are still here and ready to retry.";
    }
    if (assembly.status === "portraits") {
      return "The playable matter is ready. Legal Arena is now creating the two portraits that bring the opening intake to life.";
    }
    if (assembly.status === "opening") {
      return "Everything is assembled. Your new client file is opening now.";
    }
    if (assembly.brief?.mode === "template") {
      return "Legal Arena is adapting the selected matter to your progression, assigning your side, and preparing the opening intake.";
    }
    return "Legal Arena is writing two competing accounts, useful evidence paths, proof gaps, and a focused opening intake for this matter.";
  }, [assembly.brief?.mode, assembly.status]);

  return (
    <div
      className="fixed inset-0 z-[130] overflow-y-auto bg-[#030507]/95 text-white backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-assembly-heading"
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(251,191,36,0.11),transparent_30%),radial-gradient(circle_at_82%_22%,rgba(52,211,153,0.09),transparent_28%),linear-gradient(145deg,rgba(13,23,31,0.96),rgba(3,5,7,0.98))]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-100/40 to-transparent" />

      <main className="relative mx-auto flex min-h-full w-full max-w-[1500px] items-center px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="w-full overflow-hidden rounded-[2rem] border border-white/12 bg-black/30 shadow-[0_36px_120px_rgba(0,0,0,0.62)]">
          <header className="relative overflow-hidden border-b border-white/10 px-5 py-5 sm:px-7 lg:px-9 lg:py-7">
            <div className="pointer-events-none absolute -right-16 -top-32 h-72 w-72 rounded-full bg-amber-200/10 blur-3xl" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-amber-100/80">
                  <HeroIcons.BriefcaseIcon className="h-4 w-4" aria-hidden="true" />
                  <p className="text-xs font-black uppercase tracking-[0.22em]">Live case assembly</p>
                </div>
                <h1
                  id="case-assembly-heading"
                  ref={headingRef}
                  tabIndex={-1}
                  className="arena-headline mt-3 text-3xl uppercase outline-none sm:text-4xl lg:text-5xl"
                >
                  {assembly.status === "error"
                    ? "The file needs another pass"
                    : preview?.title || (assembly.brief?.mode === "template" ? "Preparing your matter" : "Crafting a new matter")}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/68 sm:text-base">{currentMessage}</p>
              </div>

              <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 sm:text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-white/40">Expected wait</p>
                <p className="mt-1 text-sm font-bold text-white">
                  {longWait ? "Still working — complex files can take longer" : "Usually about 1–2 minutes"}
                </p>
                <p className="mt-1 font-mono text-xs text-white/45">Elapsed {formatElapsed(elapsedMs)}</p>
              </div>
            </div>
          </header>

          <div className="grid min-h-[34rem] lg:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1.4fr)]">
            <aside className="border-b border-white/10 bg-white/[0.025] p-5 sm:p-7 lg:border-b-0 lg:border-r lg:p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Assembly record</p>
              <ol className="mt-5 space-y-1" aria-label="Case assembly progress" aria-live="polite">
                {CASE_ASSEMBLY_STAGES.map((stage, index) => {
                  const state = getCaseAssemblyStageState(stage.key, assembly.status);
                  return (
                    <li key={stage.key} className="relative flex gap-3 pb-5 last:pb-0">
                      {index < CASE_ASSEMBLY_STAGES.length - 1 ? (
                        <span className={`absolute left-[0.95rem] top-8 h-[calc(100%-1.5rem)] w-px ${state === "complete" ? "bg-emerald-200/25" : "bg-white/8"}`} />
                      ) : null}
                      <StatusMark state={state} />
                      <div className="min-w-0 pt-0.5">
                        <p className={`text-sm font-bold ${state === "upcoming" ? "text-white/38" : "text-white"}`}>{stage.title}</p>
                        <p className={`mt-1 text-xs leading-5 ${state === "upcoming" ? "text-white/26" : "text-white/52"}`}>{stage.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </aside>

            <section className="min-w-0 p-5 sm:p-7 lg:p-8">
              <div className="flex flex-wrap gap-2">
                <span className="badge h-auto border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/75">
                  {assembly.brief?.categoryTitle || "Case category"}
                </span>
                <span className="badge h-auto border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/75">
                  {assembly.brief?.difficultyLabel || "Difficulty selected"}
                </span>
                <span className="badge h-auto border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/75">
                  {assembly.brief?.countryName || "Jurisdiction selected"}
                </span>
                <span className="badge h-auto border-amber-100/20 bg-amber-100/[0.07] px-3 py-2 text-xs font-semibold text-amber-100/80">
                  {assembly.brief?.mode === "template" ? "Selected matter" : "Fresh case"}
                </span>
              </div>

              {preview ? (
                <div key={preview.id || preview.title} className="mt-6 animate-popup space-y-4">
                  <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/[0.075] via-white/[0.035] to-emerald-300/[0.045] p-5 shadow-xl shadow-black/20 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100/65">Dossier assembled</p>
                        <h2 className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">{preview.title}</h2>
                        <p className="mt-2 text-sm text-white/58">{preview.courtName || "Court assignment ready"}</p>
                      </div>
                      <span className="badge h-auto shrink-0 border-emerald-200/25 bg-emerald-200/10 px-3 py-2 text-xs font-bold text-emerald-100">
                        You represent {preview.playerSideLabel || "the assigned side"}
                      </span>
                    </div>

                    <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                        <dt className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Your client</dt>
                        <dd className="mt-1.5 text-base font-bold text-white">{preview.clientName || preview.playerPartyName || "Client assigned"}</dd>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                        <dt className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">Opposing party</dt>
                        <dd className="mt-1.5 text-base font-bold text-white">{preview.opponentName || preview.opponentPartyName || "Opposition assigned"}</dd>
                      </div>
                    </dl>

                    {preview.objective ? (
                      <div className="mt-3 rounded-2xl border border-amber-100/10 bg-amber-100/[0.045] p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-100/55">Initial client objective</p>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/70">{preview.objective}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <PortraitStatus
                      label="Client portrait"
                      name={preview.clientName || preview.playerPartyName}
                      status={portraits.client?.status}
                      image={portraits.client?.image}
                    />
                    <PortraitStatus
                      label="Opposing counsel"
                      name={preview.opponentName ? `Counsel for ${preview.opponentName}` : "Opposing counsel"}
                      status={portraits.opponent?.status}
                      image={portraits.opponent?.image}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-6 animate-opacity rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-amber-100/15 bg-amber-100/[0.06] text-amber-100">
                      <HeroIcons.DocumentMagnifyingGlassIcon className="h-6 w-6" aria-hidden="true" />
                      {assembly.status !== "error" ? <span className="absolute -right-1 -top-1 loading loading-ring loading-sm" /> : null}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/38">Case file</p>
                      <p className="mt-1 text-base font-bold text-white">
                        {assembly.status === "error" ? "Assembly paused" : "Details will appear here as soon as the matter is playable"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-3" aria-hidden="true">
                    <div className="h-3 w-4/5 animate-pulse rounded-full bg-white/8" />
                    <div className="h-3 w-2/5 animate-pulse rounded-full bg-white/6" />
                    <div className="grid gap-3 pt-3 sm:grid-cols-2">
                      <div className="h-24 animate-pulse rounded-2xl bg-white/[0.035]" />
                      <div className="h-24 animate-pulse rounded-2xl bg-white/[0.035]" />
                    </div>
                  </div>
                </div>
              )}

              {assembly.status === "error" ? (
                <div role="alert" className="alert mt-5 block animate-popup border border-error/25 bg-error/10 text-white shadow-lg">
                  <div className="flex items-start gap-3">
                    <HeroIcons.ExclamationTriangleIcon className="mt-0.5 h-6 w-6 shrink-0 text-error" aria-hidden="true" />
                    <div>
                      <h3 className="font-bold text-white">Case creation stopped</h3>
                      <p className="mt-1 text-sm leading-6 text-white/68">{assembly.error || "Legal Arena could not finish this case. Please try again."}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button type="button" className="btn border-amber-100 bg-amber-100 text-black hover:border-amber-200 hover:bg-amber-200" onClick={onRetry}>
                      <HeroIcons.ArrowPathIcon className="h-5 w-5" aria-hidden="true" />
                      Retry case assembly
                    </button>
                    <button type="button" className="btn border-white/12 bg-white/[0.06] text-white hover:bg-white/10" onClick={onReturn}>
                      Return to dashboard
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

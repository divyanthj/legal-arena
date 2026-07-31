"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LAW_SOURCE,
  LAW_SOURCE_STORAGE_KEY,
  normalizeLawSource,
} from "@/libs/game/lawSource";

const CHANGE_EVENT = "legal-arena:law-source-change";

const persist = async (lawSource) => {
  try {
    await fetch("/api/players/law-source", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lawSource }),
    });
  } catch (error) {
    console.error("Could not save law-source preference", error);
  }
};

export const useLawSourceSelection = () => {
  const [lawSource, setLawSource] = useState(DEFAULT_LAW_SOURCE);

  useEffect(() => {
    const stored = normalizeLawSource(window.localStorage.getItem(LAW_SOURCE_STORAGE_KEY));
    if (stored) setLawSource(stored);
    fetch("/api/players/law-source")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const profile = normalizeLawSource(data?.lawSource);
        if (!profile) return;
        setLawSource(profile);
        window.localStorage.setItem(LAW_SOURCE_STORAGE_KEY, profile);
      })
      .catch(() => {});

    const sync = (event) => {
      const next = normalizeLawSource(event?.detail?.lawSource || event?.newValue);
      if (next) setLawSource(next);
    };
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const selectLawSource = (nextValue) => {
    const next = normalizeLawSource(nextValue) || DEFAULT_LAW_SOURCE;
    setLawSource(next);
    window.localStorage.setItem(LAW_SOURCE_STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { lawSource: next } }));
    void persist(next);
  };

  return { lawSource, selectLawSource };
};

export default function LawSourceToggle({ value, onChange, disabled = false }) {
  const actual = value === "real";
  return (
    <div className="rounded-xl border border-white/12 bg-white/[0.035] px-4 py-3">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">Use real laws</span>
          <span className="mt-1 block text-xs leading-5 text-white/48">
            {actual
              ? "Research applicable provisions from official sources."
              : "Use the game rulebook with automatic applicable-law suggestions."}
          </span>
        </span>
        <input
          type="checkbox"
          className="checkbox checkbox-warning shrink-0"
          checked={actual}
          disabled={disabled}
          aria-label="Use real laws"
          onChange={(event) => onChange(event.target.checked ? "real" : "rulebook")}
        />
      </label>
      <p className="mt-2 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-white/38">
        {actual ? "Real laws" : "Game rulebook"}
      </p>
    </div>
  );
}

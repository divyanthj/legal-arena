"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as HeroIcons from "@heroicons/react/24/outline";
import {
  CASE_COUNTRIES,
  COUNTRY_STORAGE_KEY,
  DEFAULT_COUNTRY_CODE,
  getCountryByCode,
  normalizeCountryCode,
  resolveInitialCountryCode,
} from "@/libs/game/countries";

export const CountryFlag = ({ code, className = "h-5 w-7" }) => {
  const normalizedCode = normalizeCountryCode(code) || DEFAULT_COUNTRY_CODE;
  const country = getCountryByCode(normalizedCode);

  return (
    <span
      className={`fi fi-${normalizedCode.toLowerCase()} inline-block shrink-0 rounded-sm bg-cover shadow-[0_0_0_1px_rgba(255,255,255,0.16)] ${className}`}
      role="img"
      aria-label={`${country?.name || normalizedCode} flag`}
    />
  );
};

export const CountryBadge = ({ caseCountry, className = "" }) => {
  const country = getCountryByCode(caseCountry?.code);
  if (!country) return null;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/24 px-3 py-1 text-xs font-semibold text-white/70 ${className}`}
    >
      <CountryFlag code={country.code} className="h-3.5 w-5" />
      <span>{country.name}</span>
    </span>
  );
};

const COUNTRY_CHANGE_EVENT = "legal-arena:case-country-change";

const persistPlayerCountryPreference = async (countryCode) => {
  try {
    const response = await fetch("/api/players/case-country", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryCode }),
    });

    if (!response.ok) {
      throw new Error(`Country preference update failed with ${response.status}`);
    }
  } catch (error) {
    console.error("Could not save player country preference", error);
  }
};

export const useCaseCountrySelection = (
  detectedCountryCode = DEFAULT_COUNTRY_CODE,
  detectedCountrySource = "detected"
) => {
  const detected = normalizeCountryCode(detectedCountryCode) || DEFAULT_COUNTRY_CODE;
  const [countryCode, setCountryCode] = useState(detected);
  const [selectionSource, setSelectionSource] = useState(
    detectedCountrySource === "profile"
      ? "profile"
      : detectedCountrySource === "default"
      ? "default"
      : "detected"
  );

  useEffect(() => {
    let storedCode = "";
    try {
      storedCode = window.localStorage.getItem(COUNTRY_STORAGE_KEY) || "";
    } catch {
      // Storage may be unavailable in privacy-restricted browsers.
    }

    const profileCode = detectedCountrySource === "profile" ? detected : "";
    const resolved = resolveInitialCountryCode({
      profileCode,
      storedCode,
      detectedCode: detected,
    });
    setCountryCode(resolved);
    setSelectionSource(
      profileCode
        ? "profile"
        : normalizeCountryCode(storedCode)
        ? "stored"
        : detectedCountrySource === "default"
        ? "default"
        : "detected"
    );

    if (profileCode) {
      try {
        window.localStorage.setItem(COUNTRY_STORAGE_KEY, profileCode);
      } catch {
        // The server profile remains authoritative when storage is unavailable.
      }
    } else if (normalizeCountryCode(storedCode)) {
      void persistPlayerCountryPreference(normalizeCountryCode(storedCode));
    }
  }, [detected, detectedCountrySource]);

  useEffect(() => {
    const syncCountry = (event) => {
      if (event instanceof StorageEvent && event.key !== COUNTRY_STORAGE_KEY) return;
      const nextCode = normalizeCountryCode(
        event?.detail?.countryCode || event?.newValue
      );
      if (!nextCode) return;
      setCountryCode(nextCode);
      setSelectionSource("manual");
    };

    window.addEventListener(COUNTRY_CHANGE_EVENT, syncCountry);
    window.addEventListener("storage", syncCountry);
    return () => {
      window.removeEventListener(COUNTRY_CHANGE_EVENT, syncCountry);
      window.removeEventListener("storage", syncCountry);
    };
  }, []);

  const selectCountry = (nextCode) => {
    const normalized = normalizeCountryCode(nextCode);
    if (!normalized) return;

    setCountryCode(normalized);
    setSelectionSource("manual");
    try {
      window.localStorage.setItem(COUNTRY_STORAGE_KEY, normalized);
    } catch {
      // The in-memory selection still applies when storage is unavailable.
    }
    window.dispatchEvent(
      new CustomEvent(COUNTRY_CHANGE_EVENT, {
        detail: { countryCode: normalized },
      })
    );
    void persistPlayerCountryPreference(normalized);
  };

  return { countryCode, country: getCountryByCode(countryCode), selectionSource, selectCountry };
};

export default function CountryFlagPicker({
  value,
  onChange,
  detectedCountryCode = DEFAULT_COUNTRY_CODE,
  disabled = false,
  label = "Case country",
  id = "case-country",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const searchRef = useRef(null);
  const selected = getCountryByCode(value) || getCountryByCode(DEFAULT_COUNTRY_CODE);
  const detected = getCountryByCode(detectedCountryCode);
  const countries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = normalizedQuery
      ? CASE_COUNTRIES.filter(
          (country) =>
            country.name.toLowerCase().includes(normalizedQuery) ||
            country.code.toLowerCase().includes(normalizedQuery)
        )
      : CASE_COUNTRIES;
    const priorityCodes = [selected?.code, detected?.code].filter(Boolean);

    return [...matches].sort((left, right) => {
      const leftPriority = priorityCodes.indexOf(left.code);
      const rightPriority = priorityCodes.indexOf(right.code);
      if (leftPriority >= 0 || rightPriority >= 0) {
        if (leftPriority < 0) return 1;
        if (rightPriority < 0) return -1;
        return leftPriority - rightPriority;
      }
      return left.name.localeCompare(right.name);
    });
  }, [detected?.code, query, selected?.code]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        containerRef.current?.querySelector("button")?.focus();
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const chooseCountry = (country) => {
    onChange(country.code);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative" id={id}>
      <p className="arena-kicker">{label}</p>
      <button
        type="button"
        className="mt-3 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-white/12 bg-white/[0.035] px-4 py-3 text-left transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-3">
          <CountryFlag code={selected.code} className="h-5 w-8" />
          <span className="truncate text-sm font-semibold text-white">{selected.name}</span>
        </span>
        <HeroIcons.ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-white/50 transition ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-[140] mt-2 w-full min-w-[18rem] overflow-hidden rounded-2xl border border-white/12 bg-[#111] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.72)] sm:min-w-[24rem]"
          role="dialog"
          aria-label="Select case country"
        >
          <div className="relative">
            <HeroIcons.MagnifyingGlassIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search countries"
              aria-label="Search countries"
              className="h-10 w-full rounded-xl border border-white/10 bg-black/35 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-amber-200/45"
            />
          </div>
          <p className="mt-3 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-white/38">
            Choose a country
          </p>
          <div className="arena-scroll mt-2 grid max-h-72 grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1.5 overflow-y-auto pr-1">
            {countries.map((country) => {
              const isSelected = country.code === selected.code;
              return (
                <button
                  key={country.code}
                  type="button"
                  title={country.name}
                  aria-label={`Select ${country.name}`}
                  aria-pressed={isSelected}
                  className={`group relative flex h-14 items-center justify-center overflow-hidden rounded-md border transition focus:outline-none focus:ring-2 focus:ring-amber-200/70 ${
                    isSelected
                      ? "border-amber-200/70 bg-amber-200/14"
                      : "border-white/8 bg-white/[0.025] hover:border-white/25 hover:bg-white/[0.06]"
                  }`}
                  onClick={() => chooseCountry(country)}
                >
                  <CountryFlag
                    code={country.code}
                    className="h-5 w-8 transition-transform duration-150 group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-1 bottom-1 truncate text-center text-[0.56rem] font-medium leading-none text-white/75 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    {country.name}
                  </span>
                </button>
              );
            })}
          </div>
          {!countries.length ? (
            <p className="py-8 text-center text-sm text-white/50">No matching country.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

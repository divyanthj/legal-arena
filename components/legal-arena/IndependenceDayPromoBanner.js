"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { INDEPENDENCE_DAY_PROMO } from "@/libs/independenceDayPromo";

const getTimeRemaining = () => {
  const endsAt = new Date(INDEPENDENCE_DAY_PROMO.endsAt).getTime();
  const totalMs = Math.max(0, endsAt - Date.now());
  const totalSeconds = Math.floor(totalMs / 1000);

  return {
    totalMs,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
};

const CountdownUnit = ({ value, label }) => (
  <div className="min-w-[4.25rem] rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
    <div className="text-2xl font-black tabular-nums leading-none text-white">
      {String(value).padStart(2, "0")}
    </div>
    <div className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-sky-100/58">
      {label}
    </div>
  </div>
);

export default function IndependenceDayPromoBanner() {
  const [timeRemaining, setTimeRemaining] = useState(() => getTimeRemaining());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimeRemaining(getTimeRemaining());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const countdownUnits = useMemo(
    () => [
      { label: "Days", value: timeRemaining.days },
      { label: "Hours", value: timeRemaining.hours },
      { label: "Min", value: timeRemaining.minutes },
    ],
    [timeRemaining]
  );

  if (timeRemaining.totalMs <= 0) {
    return null;
  }

  return (
    <div className="arena-surface-soft mx-auto mb-8 flex max-w-5xl flex-col gap-5 border-sky-200/24 bg-sky-200/[0.06] px-5 py-4 text-left md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-100/78">
          INDEPENDENCE DAY OFFER
        </p>
        <h2 className="mt-2 text-xl font-semibold leading-tight text-white">
          Your courtroom. Your arguments. Your verdict.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-50/78">
          Get 30% off lifetime access and step into an AI courtroom where every
          argument is yours to make.
        </p>
      </div>
      <div className="flex w-full shrink-0 flex-col gap-3 md:w-auto md:items-end">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-100/72">
          Sale ends in
        </p>
        <div className="grid w-full grid-cols-3 gap-2 md:w-auto">
          {countdownUnits.map((unit) => (
            <CountdownUnit key={unit.label} {...unit} />
          ))}
        </div>
        <Link
          href="/dashboard"
          className="arena-btn-light inline-flex w-full justify-center px-5 py-3 text-sm md:w-auto"
        >
          Claim My 30% Off
        </Link>
      </div>
    </div>
  );
}

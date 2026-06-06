"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import * as HeroIcons from "@heroicons/react/24/outline";

const normalizeSearchText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const fuzzyNameMatch = (name = "", query = "") => {
  const normalizedName = normalizeSearchText(name);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return true;
  }

  let queryIndex = 0;
  for (const character of normalizedName) {
    if (character === normalizedQuery[queryIndex]) {
      queryIndex += 1;
    }
    if (queryIndex === normalizedQuery.length) {
      return true;
    }
  }

  return false;
};

const getArenaHeadshot = (value = "") => {
  const image = String(value || "").trim();

  return image.startsWith("/api/players/avatar/") || image.startsWith("data:image/")
    ? image
    : "/images/profile.jpg";
};

const isDefaultHeadshot = (value = "") => getArenaHeadshot(value) === "/images/profile.jpg";

const LawyerPortrait = ({ image = "", name = "" }) => {
  const headshot = getArenaHeadshot(image);
  const fallbackHeadshot = getArenaHeadshot("");

  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/[0.04] shadow-[0_0_0_4px_rgba(255,255,255,0.025)]">
      <img
        src={headshot}
        alt={`${name || "Counsel"} headshot`}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = fallbackHeadshot;
        }}
        style={{ objectPosition: "center calc(50% + 1px)" }}
        className={`block h-full w-full object-cover object-center ${
          isDefaultHeadshot(image) ? "scale-[1.62]" : "scale-[1.09]"
        }`}
      />
    </div>
  );
};

const getRecordLabel = (entry = {}) =>
  `${entry.wins || 0}-${entry.losses || 0}-${entry.draws || 0}`;

const getWinRate = (entry = {}) => {
  const total = (entry.wins || 0) + (entry.losses || 0) + (entry.draws || 0);

  if (total <= 0) {
    return "Unrated";
  }

  return `${Math.round(((entry.wins || 0) / total) * 100)}% win rate`;
};

const getPvpRecordLabel = (entry = {}) => {
  const pvp = entry.pvp || {};

  return `${pvp.wins || 0}-${pvp.losses || 0}-${pvp.draws || 0}`;
};

export default function BarAssociationDirectory({
  players = [],
  viewerUserId = "",
  viewerName = "Counsel",
}) {
  const [search, setSearch] = useState("");
  const query = search.trim();
  const viewer = players.find((player) => String(player.id) === String(viewerUserId));
  const challengers = players.filter((player) => String(player.id) !== String(viewerUserId));
  const filteredPlayers = useMemo(
    () => players.filter((player) => fuzzyNameMatch(player.name, query)),
    [players, query]
  );
  const filteredChallengerCount = filteredPlayers.filter(
    (player) => String(player.id) !== String(viewerUserId)
  ).length;

  return (
    <main className="arena-app-shell min-h-screen max-w-full overflow-x-hidden px-3 py-3 md:px-6 md:py-6">
      <section className="mx-auto w-full max-w-[1600px] min-w-0 space-y-4 arena-reveal">
        <div
          className="arena-surface arena-scanline arena-column-bg overflow-hidden"
          style={{
            backgroundImage: [
              "linear-gradient(90deg, rgba(4,4,4,0.96) 0%, rgba(4,4,4,0.9) 42%, rgba(4,4,4,0.62) 72%, rgba(4,4,4,0.92) 100%)",
              "linear-gradient(180deg, rgba(15,37,45,0.16), rgba(0,0,0,0.1))",
              "url('/images/office.jpg')",
            ].join(", "),
            backgroundPosition: "center, center, 62% center",
            backgroundRepeat: "no-repeat, no-repeat, no-repeat",
            backgroundSize: "cover, cover, auto 120%",
          }}
        >
          <div className="p-5 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard" className="arena-btn-dark inline-flex px-4 py-2 text-sm">
                Back to Dashboard
              </Link>
              <span className="badge badge-outline border-white/15 text-white/80">
                Player Directory
              </span>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0">
                <p className="arena-kicker">LEGAL ARENA</p>
                <h1 className="arena-headline mt-4 max-w-4xl break-words text-4xl uppercase leading-[0.92] sm:text-5xl md:text-7xl">
                  Bar Association
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-white/68 md:text-base">
                  Find counsel across the arena, inspect their public dossier, and choose who
                  deserves the next PVP challenge.
                </p>
              </div>

              <div className="arena-surface-soft flex flex-col justify-between p-5">
                <div>
                  <p className="arena-kicker">Roster</p>
                  <p className="mt-3 text-4xl font-semibold text-white">{players.length}</p>
                  <p className="mt-2 text-sm text-white/54">
                    {challengers.length} challenge targets outside your own profile.
                  </p>
                </div>
                {viewer ? (
                  <Link
                    href={`/dashboard/players/${viewer.id}`}
                    className="mt-6 flex items-center gap-3 rounded-lg border border-white/10 bg-black/24 p-3 transition hover:border-white/22"
                  >
                    <LawyerPortrait image={viewer.image} name={viewerName} />
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.15em] text-white/40">
                        Your listing
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-white">
                        {viewerName}
                      </p>
                    </div>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <section className="arena-surface">
          <div className="p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="arena-kicker">Search Lawyers</p>
                <h2 className="arena-headline mt-2 text-2xl">Find a player to challenge</h2>
              </div>
              <div className="relative w-full lg:max-w-xl">
                <HeroIcons.MagnifyingGlassIcon
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/36"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search lawyers by name"
                  aria-label="Search lawyers by name"
                  className="h-12 w-full rounded-full border border-white/12 bg-white/[0.04] px-12 text-sm font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-sky-300/60"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-white/42">
              <span>{filteredPlayers.length} visible lawyers</span>
              <span>{filteredChallengerCount} challenge targets</span>
              {query ? <span>Search: {query}</span> : null}
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              {filteredPlayers.length > 0 ? (
                filteredPlayers.map((entry) => {
                  const isViewer = String(entry.id) === String(viewerUserId);

                  return (
                    <Link
                      key={entry.id}
                      href={`/dashboard/players/${entry.id}`}
                      className={`arena-surface-soft group flex min-w-0 flex-col gap-4 p-4 transition hover:-translate-y-0.5 hover:border-white/20 sm:flex-row sm:items-center sm:justify-between ${
                        isViewer ? "opacity-[0.78]" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <LawyerPortrait image={entry.image} name={entry.name} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-lg font-semibold text-white">
                              <span className="mr-2 text-white/45">#{entry.rank}</span>
                              {entry.name}
                            </p>
                            {isViewer ? (
                              <span className="badge border border-sky-300/25 bg-sky-300/10 text-sky-100">
                                You
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-white/52">
                            {entry.completedCases || 0} matters | Record {getRecordLabel(entry)} |{" "}
                            {getWinRate(entry)}
                          </p>
                          <p className="mt-1 text-sm text-white/42">
                            PVP {getPvpRecordLabel(entry)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:w-44">
                        <div className="rounded-lg border border-white/10 bg-black/22 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-white/36">
                            Rating
                          </p>
                          <p className="mt-1 text-lg font-semibold text-emerald-300">
                            {entry.overallRating || 1000}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/22 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-white/36">
                            XP
                          </p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {entry.overallXp || 0}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="arena-surface-soft border-dashed p-8 text-center lg:col-span-2">
                  <p className="text-lg font-semibold text-white">No lawyers match that search</p>
                  <p className="mt-2 text-sm text-white/62">
                    Try a shorter name fragment or clear the search to browse the full bar.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

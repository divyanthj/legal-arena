import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import DevelopmentAccessGate from "@/components/legal-arena/DevelopmentAccessGate";
import { userCanAccessArena } from "@/libs/admin";
import { getPublicPlayerProfile } from "@/libs/game/store";
import { LEGAL_CASE_CATEGORIES } from "@/libs/game/categories";

export const dynamic = "force-dynamic";

const statusLabel = {
  interview: "Interview",
  courtroom: "In Court",
  verdict: "Verdict Ready",
};

const winnerLabel = {
  player: "Won",
  opponent: "Lost",
  draw: "Drew",
  "": "In Progress",
};

const isValidDate = (value) => {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const formatDate = (value, fallback = "Unknown date") => {
  if (!isValidDate(value)) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const formatDateTime = (value, fallback = "Time unavailable") => {
  if (!isValidDate(value)) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const getCategoryTitle = (slug) =>
  LEGAL_CASE_CATEGORIES.find((category) => category.slug === slug)?.title || slug;

const renderInterviewSpeaker = (entry, playerName) =>
  entry.role === "player" ? playerName : entry.speaker;

const renderCourtSpeaker = (entry, playerName, caseSession) =>
  entry.speaker === "player"
    ? playerName
    : caseSession.opponentPartyName || caseSession.premise?.opponentName || "Opponent";

export default async function PlayerProfilePage({ params }) {
  const session = await getServerSession(authOptions);

  if (!(await userCanAccessArena(session))) {
    return <DevelopmentAccessGate email={session.user?.email || ""} />;
  }

  const profile = await getPublicPlayerProfile(params.playerId);

  if (!profile) {
    notFound();
  }

  const { player, cases } = profile;
  const joinedLabel = isValidDate(player.joinedAt)
    ? `Joined ${formatDate(player.joinedAt)}`
    : "Join date unavailable";

  return (
    <main className="min-h-screen bg-base-200 px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="card border border-base-300 bg-neutral text-neutral-content shadow-2xl">
          <div className="card-body p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/dashboard"
                    className="btn btn-ghost btn-sm text-neutral-content"
                  >
                    Back to Dashboard
                  </Link>
                  <span className="badge badge-outline border-primary/40 text-neutral-content">
                    Player Profile
                  </span>
                </div>
                <h1 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">
                  {player.name}
                </h1>
                <p className="mt-3 max-w-2xl text-neutral-content/75">
                  Browse this player&apos;s matter history, interview exchanges, and
                  courtroom record across the arena.
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-content/70">
                  <span>{joinedLabel}</span>
                  <span>{player.completedCases} completed matters</span>
                  <span>
                    Record {player.wins}-{player.losses}-{player.draws}
                  </span>
                </div>
              </div>
              <div className="stats stats-vertical rounded-box bg-black/20 text-neutral-content sm:stats-horizontal">
                <div className="stat px-5 py-4">
                  <div className="stat-title text-neutral-content/55">
                    Overall Rating
                  </div>
                  <div className="stat-value text-3xl">{player.overallRating}</div>
                </div>
                <div className="stat px-5 py-4">
                  <div className="stat-title text-neutral-content/55">XP</div>
                  <div className="stat-value text-3xl">{player.overallXp}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="space-y-6">
            <div className="card border border-base-300 bg-base-100 shadow-xl">
              <div className="card-body p-6">
                <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                  Specialty Record
                </p>
                <h2 className="mt-2 text-2xl font-bold">Category progression</h2>
                <div className="mt-5 space-y-3">
                  {(player.categoryStats || []).map((category) => (
                    <article
                      key={category.categorySlug}
                      className="rounded-box bg-base-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">
                          {getCategoryTitle(category.categorySlug)}
                        </p>
                        <span className="badge badge-outline">
                          {category.rating}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-base-content/70">
                        {category.completedCases} completed, unlock level{" "}
                        {category.unlockedComplexity}
                      </p>
                      <p className="mt-1 text-sm text-base-content/60">
                        Record {category.wins}-{category.losses}-{category.draws}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="card border border-base-300 bg-base-100 shadow-xl">
              <div className="card-body p-6">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-base-content/50">
                      Matter Archive
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">Cases and transcripts</h2>
                  </div>
                  <span className="text-sm text-base-content/55">
                    {cases.length} visible matters
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {cases.length === 0 ? (
                    <div className="rounded-box border border-dashed border-base-300 bg-base-200/70 p-8 text-center">
                      <p className="text-lg font-semibold">No visible matters yet</p>
                      <p className="mt-2 text-sm text-base-content/65">
                        This player has not opened a public case record yet.
                      </p>
                    </div>
                  ) : (
                    cases.map((caseSession) => (
                      <article
                        key={caseSession.id}
                        className="rounded-box border border-base-300 bg-base-100 p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="badge badge-outline">
                                {caseSession.practiceArea}
                              </span>
                              <span className="badge badge-outline">
                                {caseSession.primaryCategory}
                              </span>
                              <span className="badge badge-outline">
                                Complexity {caseSession.complexity}
                              </span>
                              <span className="badge badge-outline">
                                {statusLabel[caseSession.status] || caseSession.status}
                              </span>
                              <span className="badge badge-outline">
                                {winnerLabel[caseSession.verdict?.winner || ""]}
                              </span>
                            </div>
                            <h3 className="mt-3 text-xl font-bold">{caseSession.title}</h3>
                            <p className="mt-1 text-sm text-base-content/60">
                              Updated {formatDate(caseSession.updatedAt)} in{" "}
                              {caseSession.premise?.courtName || "Unknown court"}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-base-content/75">
                              {caseSession.premise?.overview || "No case overview available."}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-4 text-sm text-base-content/70">
                              <span>Plaintiff: {caseSession.plaintiffName}</span>
                              <span>Defendant: {caseSession.defendantName}</span>
                              <span>
                                Side played:{" "}
                                {caseSession.playerSide === "opponent"
                                  ? "Defendant"
                                  : "Plaintiff"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 space-y-4">
                          <details className="group rounded-box bg-base-200 p-4" open>
                            <summary className="cursor-pointer list-none font-semibold">
                              Interview transcript
                            </summary>
                            <div className="mt-4 space-y-3">
                              {(caseSession.interviewTranscript || []).length === 0 ? (
                                <p className="text-sm text-base-content/60">
                                  No interview exchanges recorded.
                                </p>
                              ) : (
                                (caseSession.interviewTranscript || []).map((entry, index) => (
                                  <div
                                    key={`${caseSession.id}-interview-${index}`}
                                    className={`rounded-box p-4 ${
                                      entry.role === "player"
                                        ? "ml-auto max-w-[95%] bg-primary/10"
                                        : "bg-base-100"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="font-semibold">
                                        {renderInterviewSpeaker(entry, player.name)}
                                      </p>
                                      <p className="text-xs text-base-content/45">
                                        {formatDateTime(entry.createdAt)}
                                      </p>
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                                      {entry.text}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>
                          </details>

                          <details className="group rounded-box bg-base-200 p-4" open>
                            <summary className="cursor-pointer list-none font-semibold">
                              Courtroom transcript
                            </summary>
                            <div className="mt-4 space-y-3">
                              {(caseSession.courtroomTranscript || []).length === 0 ? (
                                <p className="text-sm text-base-content/60">
                                  No courtroom rounds recorded yet.
                                </p>
                              ) : (
                                (caseSession.courtroomTranscript || []).map((entry, index) => (
                                  <div
                                    key={`${caseSession.id}-court-${index}`}
                                    className={`rounded-box p-4 ${
                                      entry.speaker === "player"
                                        ? "ml-auto max-w-[95%] bg-primary/10"
                                        : "bg-base-100"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="font-semibold">
                                        {renderCourtSpeaker(
                                          entry,
                                          player.name,
                                          caseSession
                                        )}
                                      </p>
                                      <p className="text-xs text-base-content/45">
                                        Round {entry.round}
                                      </p>
                                    </div>
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                                      {entry.text}
                                    </p>
                                  </div>
                                ))
                              )}
                            </div>
                          </details>

                          {caseSession.verdict?.summary ? (
                            <div className="rounded-box bg-base-200 p-4">
                              <p className="font-semibold">Verdict summary</p>
                              <p className="mt-2 text-sm leading-7 text-base-content/75">
                                {caseSession.verdict.summary}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

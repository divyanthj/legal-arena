import Link from "next/link";
import * as HeroIcons from "@heroicons/react/24/outline";
import AndroidDownloadActions from "@/components/AndroidDownloadActions";
import { getSEOTags } from "@/libs/seo";
import { getAndroidRelease } from "@/libs/appRelease";
import config from "@/config";

export const dynamic = "force-dynamic";

export const metadata = getSEOTags({
  title: "Download Legal Arena for Android",
  description:
    "Download the independently distributed Legal Arena Android beta or install the secure web app.",
  canonicalUrlRelative: "/download/android",
});

const formatBytes = (size = 0) => {
  if (!size) return "Published with the signed release";
  const megabytes = size / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 1 : 2)} MB`;
};

export default function AndroidDownloadPage() {
  const release = getAndroidRelease();

  return (
    <main className="arena-landing min-h-screen overflow-hidden bg-[#020202] text-white">
      <section className="arena-column-bg border-b border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-20">
          <Link href="/" className="arena-pill inline-flex items-center gap-2 px-4 py-2 text-sm">
            <HeroIcons.ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Legal Arena
          </Link>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.65fr)] lg:items-start">
            <section>
              <p className="arena-kicker">Independent Android Beta</p>
              <h1 className="arena-headline mt-5 max-w-4xl text-5xl uppercase leading-[0.92] md:text-7xl">
                Put the courtroom on your home screen.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/66">
                Install the signed Android app directly from {config.domainName}, or add the
                browser-managed web app. Both connect to the same Legal Arena account,
                cases, PVP docket, and Lemon Squeezy lifetime access.
              </p>

              <div className="mt-8">
                <AndroidDownloadActions release={release} />
              </div>

              {!release.available ? (
                <div className="mt-6 max-w-2xl rounded-2xl border border-amber-200/18 bg-amber-200/[0.07] p-4 text-sm leading-6 text-amber-50/78">
                  The production download remains disabled until the release is signed and
                  its checksum, size, and publication date are configured. Debug and
                  unsigned builds are never offered here.
                </div>
              ) : null}

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {[
                  ["Release", `${release.version} · ${release.channel}`],
                  ["Download size", formatBytes(release.sizeBytes)],
                  ["Requires", `Android ${release.minimumAndroid}+`],
                ].map(([label, value]) => (
                  <div key={label} className="arena-surface-soft p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/38">
                      {label}
                    </p>
                    <p className="mt-2 text-sm font-bold text-white/78">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <aside className="arena-surface overflow-hidden">
              <div className="border-b border-white/10 p-5 md:p-6">
                <p className="arena-kicker">Verify the file</p>
                <h2 className="mt-3 text-2xl font-black">Official release details</h2>
              </div>
              <dl className="space-y-5 p-5 text-sm md:p-6">
                <div>
                  <dt className="font-bold text-white/46">Package</dt>
                  <dd className="mt-1 break-all font-mono text-white/78">{release.packageId}</dd>
                </div>
                <div>
                  <dt className="font-bold text-white/46">SHA-256</dt>
                  <dd className="mt-1 break-all font-mono text-xs leading-5 text-white/68">
                    {release.sha256 || "Shown when the signed APK is published"}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-white/46">Released</dt>
                  <dd className="mt-1 text-white/78">
                    {release.releasedAt || "Awaiting signed beta"}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>

          <section className="mt-12 grid gap-5 lg:grid-cols-2">
            <article className="arena-surface p-5 md:p-7">
              <p className="arena-kicker">APK installation</p>
              <h2 className="mt-3 text-2xl font-black">Install from the website</h2>
              <ol className="mt-5 space-y-4 text-sm leading-6 text-white/66">
                {[
                  "Download the APK only from this HTTPS page.",
                  "When Android asks, allow your current browser to install unknown apps.",
                  "Review the package name and install the signed release.",
                  "Turn off the browser’s install permission afterwards if you prefer.",
                ].map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </article>

            <article className="arena-surface p-5 md:p-7">
              <p className="arena-kicker">Web app installation</p>
              <h2 className="mt-3 text-2xl font-black">Prefer browser-managed updates?</h2>
              <p className="mt-5 text-sm leading-7 text-white/66">
                Open this page in Chrome and choose <strong className="text-white">Install web app</strong>.
                The PWA gets an app icon and standalone window without enabling APK
                installation. Gameplay still requires an internet connection.
              </p>
              <div className="mt-5 rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.055] p-4 text-sm leading-6 text-emerald-50/75">
                Your purchase belongs to your Legal Arena account—not one phone. Sign in
                again after reinstalling to restore access.
              </div>
            </article>
          </section>

          <section className="arena-surface mt-5 p-5 md:p-7">
            <p className="arena-kicker">What changed</p>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {release.changelog.map((entry) => (
                <li key={entry} className="flex gap-3 text-sm leading-6 text-white/66">
                  <HeroIcons.CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
                  {entry}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}


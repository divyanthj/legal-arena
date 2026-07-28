"use client";

import { useEffect, useState } from "react";
import * as HeroIcons from "@heroicons/react/24/outline";
import { trackGoal } from "@/libs/datafast";

export default function AndroidDownloadActions({ release }) {
  const [pwaInstallAvailable, setPwaInstallAvailable] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const sync = () => {
      setPwaInstallAvailable(Boolean(window.__legalArenaPwaInstallAvailable));
      setStandalone(
        window.matchMedia("(display-mode: standalone)").matches ||
          window.navigator.standalone === true
      );
    };

    sync();
    window.addEventListener("legal-arena:pwa-install-available", sync);
    window.addEventListener("appinstalled", sync);
    return () => {
      window.removeEventListener("legal-arena:pwa-install-available", sync);
      window.removeEventListener("appinstalled", sync);
    };
  }, []);

  const startPwaInstall = () => {
    trackGoal("pwa_install_clicked", { source: "android_download_page" });
    window.dispatchEvent(new CustomEvent("legal-arena:install-pwa"));
  };

  const apkButton = release.available ? (
    <a
      href={release.apkUrl}
      className="arena-btn-light flex min-h-14 w-full items-center justify-center gap-3 px-6 py-3 text-sm font-black sm:w-auto"
      download
      onClick={() =>
        trackGoal("android_apk_download_clicked", {
          version: release.version,
          channel: release.channel,
        })
      }
    >
      <HeroIcons.ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />
      Download signed APK
    </a>
  ) : (
    <button
      type="button"
      disabled
      className="flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-black text-white/42 sm:w-auto"
    >
      <HeroIcons.LockClosedIcon className="h-5 w-5" aria-hidden="true" />
      Signed beta not published yet
    </button>
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      {apkButton}
      {!standalone ? (
        <button
          type="button"
          disabled={!pwaInstallAvailable}
          onClick={startPwaInstall}
          className="arena-btn-dark flex min-h-14 w-full items-center justify-center gap-3 px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
        >
          <HeroIcons.DevicePhoneMobileIcon className="h-5 w-5" aria-hidden="true" />
          {pwaInstallAvailable ? "Install web app" : "Open in Chrome to install"}
        </button>
      ) : (
        <span className="flex min-h-14 items-center gap-2 rounded-xl border border-emerald-200/20 bg-emerald-200/10 px-5 text-sm font-bold text-emerald-100">
          <HeroIcons.CheckCircleIcon className="h-5 w-5" />
          Web app installed
        </span>
      )}
    </div>
  );
}


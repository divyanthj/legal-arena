"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as HeroIcons from "@heroicons/react/24/outline";

const VERSION_STORAGE_KEY = "legal-arena:android-shell-version";
const UPDATE_DISMISS_KEY = "legal-arena:android-update-dismissed";

const parseVersion = (value = "") =>
  String(value || "")
    .replace(/^[^0-9]*/, "")
    .split(/[.-]/)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));

const isNewerVersion = (latest = "", current = "") => {
  const left = parseVersion(latest);
  const right = parseVersion(current);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a === b) continue;
    if (typeof a === "number" && typeof b === "number") return a > b;
    return String(a).localeCompare(String(b)) > 0;
  }

  return false;
};

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

export default function AppInstallManager() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [release, setRelease] = useState(null);
  const [updateVisible, setUpdateVisible] = useState(false);

  const androidShellVersion = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(VERSION_STORAGE_KEY) || "";
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        console.error("service worker registration failed", error);
      });
    }

    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    const shellVersion = params.get("shell_version");

    if (source === "android" && shellVersion) {
      window.localStorage.setItem(VERSION_STORAGE_KEY, shellVersion);
    }

    const captureInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      window.__legalArenaPwaInstallAvailable = true;
      window.dispatchEvent(new CustomEvent("legal-arena:pwa-install-available"));
    };

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
  }, []);

  useEffect(() => {
    const current =
      window.localStorage.getItem(VERSION_STORAGE_KEY) || androidShellVersion;
    if (!current) return;

    fetch("/api/app-release", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        setRelease(payload);
        const dismissed = window.localStorage.getItem(UPDATE_DISMISS_KEY);
        setUpdateVisible(
          payload?.available &&
            isNewerVersion(payload.version, current) &&
            dismissed !== payload.version
        );
      })
      .catch((error) => console.error("app release check failed", error));
  }, [androidShellVersion]);

  const installPwa = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result?.outcome === "accepted") {
      setInstallPrompt(null);
      window.__legalArenaPwaInstallAvailable = false;
    }
    return result?.outcome === "accepted";
  }, [installPrompt]);

  useEffect(() => {
    const handler = () => installPwa();
    window.addEventListener("legal-arena:install-pwa", handler);
    return () => window.removeEventListener("legal-arena:install-pwa", handler);
  }, [installPwa]);

  useEffect(() => {
    document.documentElement.dataset.appDisplayMode = isStandalone()
      ? "standalone"
      : "browser";
  }, []);

  if (!updateVisible || !release) return null;

  return (
    <aside
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[130] mx-auto max-w-xl rounded-2xl border border-amber-200/25 bg-[#11100d]/95 p-4 text-white shadow-2xl shadow-black/60 backdrop-blur-xl"
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200/10">
          <HeroIcons.ArrowDownTrayIcon className="h-5 w-5 text-amber-100" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">Legal Arena {release.version} is ready</p>
          <p className="mt-1 text-xs leading-5 text-white/58">
            Download the signed APK and approve the Android update to keep the app shell current.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/download/android"
              className="rounded-lg bg-white px-3 py-2 text-xs font-black text-black"
            >
              View update
            </Link>
            <button
              type="button"
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/66"
              onClick={() => {
                window.localStorage.setItem(UPDATE_DISMISS_KEY, release.version);
                setUpdateVisible(false);
              }}
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

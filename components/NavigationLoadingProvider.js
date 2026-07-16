"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";

const NavigationLoadingContext = createContext({
  startNavigationLoading: () => {},
  stopNavigationLoading: () => {},
});

const navigationTips = [
  "Ask one clean question at a time. Precise intake builds a stronger record.",
  "The fact sheet is your trial notebook. Keep the helpful facts and the weak spots visible.",
  "Cite the lawbook when you argue. Unsupported confidence does not move the bench.",
  "A useful cross-point answers the other side before they get comfortable with it.",
  "Strong relief is specific. Tell the court exactly what your client needs.",
  "Watch disputed facts closely. They are often where the whole case turns.",
];

const DEFAULT_LOADING_LABEL = "Setting the stage";
const FAILSAFE_TIMEOUT_MS = 10000;
const LOADING_INDICATOR_DELAY_MS = 450;

const getNavigableInternalUrl = (anchor) => {
  const href = anchor?.getAttribute("href");

  if (!href || href.startsWith("#")) {
    return null;
  }

  const normalizedHref = href.trim().toLowerCase();

  if (
    normalizedHref.startsWith("mailto:") ||
    normalizedHref.startsWith("tel:") ||
    normalizedHref.startsWith("javascript:")
  ) {
    return null;
  }

  if (anchor.hasAttribute("download")) {
    return null;
  }

  const target = anchor.getAttribute("target");

  if (target && target.toLowerCase() !== "_self") {
    return null;
  }

  try {
    const nextUrl = new URL(anchor.href, window.location.href);
    const currentUrl = new URL(window.location.href);

    if (nextUrl.origin !== currentUrl.origin) {
      return null;
    }

    if (
      nextUrl.pathname === currentUrl.pathname &&
      nextUrl.search === currentUrl.search
    ) {
      return null;
    }

    return nextUrl;
  } catch {
    return null;
  }
};

const NavigationLoadingOverlay = ({ label, tip }) => (
  <div
    className="fixed inset-0 z-[120] flex items-center justify-center bg-[#030508]/88 px-5 text-white backdrop-blur-md"
    role="status"
    aria-live="polite"
    aria-label={label}
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.1),transparent_30%),linear-gradient(180deg,rgba(13,20,31,0.88),rgba(3,5,8,0.96))]" />
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/20" />
    <div className="relative w-full max-w-xl text-center">
      <div className="relative mx-auto grid h-24 w-24 place-items-center">
        <div className="absolute inset-0 rounded-full border border-white/12 bg-white/[0.03] shadow-[0_0_48px_rgba(111,183,255,0.2)]" />
        <div className="absolute inset-2 rounded-full border border-dashed border-white/25 motion-safe:animate-spin motion-safe:[animation-duration:6s]" />
        <div className="absolute h-3 w-3 rounded-full bg-white/90 shadow-[0_0_18px_rgba(255,255,255,0.72)] motion-safe:animate-[arena-orbit_2.8s_linear_infinite]" />
        <Image
          src="/icon.png"
          alt=""
          width={56}
          height={56}
          className="relative h-14 w-14 rounded-2xl shadow-[0_16px_34px_rgba(0,0,0,0.36)] motion-safe:animate-[arena-icon-drift_2.4s_ease-in-out_infinite]"
          aria-hidden="true"
        />
      </div>

      <p className="arena-kicker mt-8 text-white/55">Legal Arena</p>
      <h2 className="arena-headline mt-3 text-3xl uppercase sm:text-4xl">
        {label}
      </h2>
      <div className="mx-auto mt-6 max-w-md space-y-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="arena-loading-bar h-full w-1/3 rounded-full bg-white/90" />
        </div>
        <p className="text-center text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white/42">
          Tip
        </p>
        <p className="text-sm leading-6 text-white/68">{tip}</p>
      </div>
    </div>
  </div>
);

const getCurrentRouteKey = () =>
  typeof window === "undefined"
    ? ""
    : `${window.location.pathname}?${window.location.search}`;

const NavigationRouteObserver = ({ onRouteSettled }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const hasMountedRef = useRef(false);

  useEffect(() => {
    onRouteSettled(`${pathname}?${search}`, hasMountedRef.current);
    hasMountedRef.current = true;
  }, [onRouteSettled, pathname, search]);

  return null;
};

export const NavigationLoadingProvider = ({ children }) => {
  const [loadingState, setLoadingState] = useState({
    isLoading: false,
    label: DEFAULT_LOADING_LABEL,
  });
  const [tipIndex, setTipIndex] = useState(0);
  const timeoutRef = useRef(null);
  const showDelayRef = useRef(null);
  const routeKeyRef = useRef("");
  const loadingVisibleRef = useRef(false);
  const minimumVisibleUntilRef = useRef(0);
  const minimumStopRef = useRef(null);

  const clearFailsafe = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const clearShowDelay = useCallback(() => {
    if (showDelayRef.current) {
      window.clearTimeout(showDelayRef.current);
      showDelayRef.current = null;
    }
  }, []);

  const clearMinimumStop = useCallback(() => {
    if (minimumStopRef.current) {
      window.clearTimeout(minimumStopRef.current);
      minimumStopRef.current = null;
    }
  }, []);

  const stopNavigationLoading = useCallback(() => {
    const remainingMinimumMs = loadingVisibleRef.current
      ? Math.max(0, minimumVisibleUntilRef.current - Date.now())
      : 0;
    if (remainingMinimumMs > 0) {
      clearMinimumStop();
      minimumStopRef.current = window.setTimeout(
        stopNavigationLoading,
        remainingMinimumMs
      );
      return;
    }

    clearShowDelay();
    clearFailsafe();
    clearMinimumStop();
    loadingVisibleRef.current = false;
    minimumVisibleUntilRef.current = 0;
    setLoadingState((current) =>
      current.isLoading
        ? { isLoading: false, label: DEFAULT_LOADING_LABEL }
        : current
    );
  }, [clearFailsafe, clearMinimumStop, clearShowDelay]);

  const startNavigationLoading = useCallback(
    (label = DEFAULT_LOADING_LABEL, options = {}) => {
      const failsafeMs = Math.max(
        1000,
        Number(options?.failsafeMs || FAILSAFE_TIMEOUT_MS)
      );
      const delayMs = Math.max(
        0,
        Number(
          options?.delayMs === undefined
            ? LOADING_INDICATOR_DELAY_MS
            : options.delayMs
        )
      );
      const minimumVisibleMs = Math.max(
        0,
        Number(options?.minimumVisibleMs || 0)
      );
      clearFailsafe();
      clearShowDelay();
      clearMinimumStop();

      if (loadingVisibleRef.current || delayMs === 0) {
        loadingVisibleRef.current = true;
        minimumVisibleUntilRef.current = Math.max(
          minimumVisibleUntilRef.current,
          Date.now() + minimumVisibleMs
        );
        setLoadingState({ isLoading: true, label });
      } else {
        showDelayRef.current = window.setTimeout(() => {
          showDelayRef.current = null;
          loadingVisibleRef.current = true;
          minimumVisibleUntilRef.current = Date.now() + minimumVisibleMs;
          setLoadingState({ isLoading: true, label });
        }, delayMs);
      }

      timeoutRef.current = window.setTimeout(
        stopNavigationLoading,
        failsafeMs
      );
    },
    [clearFailsafe, clearMinimumStop, clearShowDelay, stopNavigationLoading]
  );

  const handleRouteSettled = useCallback(
    (routeKey, shouldStopLoading) => {
      routeKeyRef.current = routeKey;

      if (shouldStopLoading) {
        stopNavigationLoading();
      }
    },
    [stopNavigationLoading]
  );

  useEffect(() => {
    const handleClick = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = event.target.closest?.("a[href]");

      if (getNavigableInternalUrl(anchor)) {
        startNavigationLoading();
      }
    };

    const handlePopState = () => {
      if (getCurrentRouteKey() !== routeKeyRef.current) {
        startNavigationLoading();
      }
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      clearShowDelay();
      clearFailsafe();
      clearMinimumStop();
    };
  }, [clearFailsafe, clearMinimumStop, clearShowDelay, startNavigationLoading]);

  useEffect(() => {
    if (!loadingState.isLoading) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setTipIndex((current) => (current + 1) % navigationTips.length);
    }, 3500);

    return () => window.clearInterval(intervalId);
  }, [loadingState.isLoading]);

  const contextValue = useMemo(
    () => ({
      startNavigationLoading,
      stopNavigationLoading,
    }),
    [startNavigationLoading, stopNavigationLoading]
  );

  return (
    <NavigationLoadingContext.Provider value={contextValue}>
      <Suspense fallback={null}>
        <NavigationRouteObserver onRouteSettled={handleRouteSettled} />
      </Suspense>
      {children}
      {loadingState.isLoading ? (
        <NavigationLoadingOverlay
          label={loadingState.label}
          tip={navigationTips[tipIndex]}
        />
      ) : null}
    </NavigationLoadingContext.Provider>
  );
};

export const useNavigationLoading = () => useContext(NavigationLoadingContext);

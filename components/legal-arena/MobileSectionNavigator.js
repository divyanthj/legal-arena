"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  findVisibleGuidedTarget,
  isGuidedMobileViewport,
  isRenderedGuidedTarget,
  pulseHaptic,
  scrollGuidedTarget,
} from "@/libs/guidedInteractionCore.mjs";
import {
  getSectionNavigatorActiveIndex,
  isSectionNavigatorOverlayOpen,
  shouldShowSectionNavigator,
} from "@/libs/sectionNavigatorCore.mjs";

const OVERLAY_SELECTOR =
  '[role="dialog"][aria-modal="true"], [data-section-nav-overlay="true"]';

const findVisibleSectionTarget = (target, windowObject) =>
  findVisibleGuidedTarget(target, {
    root: windowObject?.document,
    windowObject,
    attribute: "data-section-nav-target",
  });

const hasVisibleOverlay = (windowObject) =>
  [...(windowObject?.document?.querySelectorAll?.(OVERLAY_SELECTOR) || [])].some(
    (element) =>
      isSectionNavigatorOverlayOpen({
        rendered: isRenderedGuidedTarget(element, windowObject),
        ariaHidden: element.getAttribute?.("aria-hidden"),
        hidden: Boolean(element.hidden),
        tagName: element.tagName,
        nativeOpen:
          String(element.tagName).toUpperCase() !== "DIALOG" ||
          Boolean(element.open),
      })
  );

export default function MobileSectionNavigator({
  sections = [],
  minimumSections = 3,
  suspended = false,
}) {
  const [state, setState] = useState({
    activeKey: "",
    availableSections: [],
    visible: false,
  });
  const frameRef = useRef(null);

  const update = useCallback(() => {
    if (typeof window === "undefined") return;

    const availableSections = sections
      .map((section) => ({
        ...section,
        element: findVisibleSectionTarget(section.target, window),
      }))
      .filter((section) => section.element);
    const viewportHeight = window.innerHeight || 0;
    const scrollHeight = document.documentElement?.scrollHeight || 0;
    const modalOpen = suspended || hasVisibleOverlay(window);
    const visible = shouldShowSectionNavigator({
      mobile: isGuidedMobileViewport(window),
      modalOpen,
      sectionCount: availableSections.length,
      viewportHeight,
      scrollHeight,
      minimumSections,
    });
    const activeIndex = getSectionNavigatorActiveIndex(
      availableSections.map((section) => section.element.getBoundingClientRect().top),
      {
        viewportHeight,
        scrollY: window.scrollY,
        scrollHeight,
      }
    );
    const activeKey = availableSections[activeIndex]?.key || "";
    const publicSections = availableSections.map(({ key, label, target }) => ({
      key,
      label,
      target,
    }));

    setState((current) => {
      const currentKeys = current.availableSections.map((section) => section.key).join("|");
      const nextKeys = publicSections.map((section) => section.key).join("|");
      if (
        current.activeKey === activeKey &&
        current.visible === visible &&
        currentKeys === nextKeys
      ) {
        return current;
      }

      return {
        activeKey,
        availableSections: publicSections,
        visible,
      };
    });
  }, [minimumSections, sections, suspended]);

  const scheduleUpdate = useCallback(() => {
    if (typeof window === "undefined" || frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      update();
    });
  }, [update]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(scheduleUpdate)
        : null;
    if (resizeObserver && document.body) {
      resizeObserver.observe(document.body);
    }

    const mutationObserver =
      typeof MutationObserver === "function"
        ? new MutationObserver(scheduleUpdate)
        : null;
    if (mutationObserver && document.body) {
      mutationObserver.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [scheduleUpdate]);

  const navigateToSection = (section) => {
    if (typeof window === "undefined") return;
    const target = findVisibleSectionTarget(section.target, window);
    if (!target) return;

    pulseHaptic("selection", window);
    scrollGuidedTarget(target, {
      windowObject: window,
      topPadding: 80,
      bottomPadding: 96,
    });
  };

  return (
    <nav
      className={`fixed right-[max(env(safe-area-inset-right),0.15rem)] top-1/2 z-[35] -translate-y-1/2 xl:hidden ${
        state.visible ? "" : "hidden"
      }`}
      aria-label="Page sections"
      aria-hidden={!state.visible}
      data-active-section={state.activeKey || undefined}
    >
      <ol>
        {state.availableSections.map((section) => {
          const active = section.key === state.activeKey;
          return (
            <li key={section.key}>
              <button
                type="button"
                className="group flex h-10 w-8 items-center justify-center"
                onClick={() => navigateToSection(section)}
                aria-label={`Go to ${section.label}`}
                aria-current={active ? "location" : undefined}
                title={section.label}
              >
                <span
                  className={`block rounded-full transition-all ${
                    active
                      ? "h-2 w-2 border border-white/45 bg-white/45"
                      : "h-1.5 w-1.5 border border-white/25 bg-transparent group-hover:border-white/45"
                  }`}
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

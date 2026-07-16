"use client";

import { useEffect } from "react";
import { trackGoal } from "@/libs/datafast";

const getDatasetParams = (element) => ({
  source: element.dataset.landingSource,
  destination: element.dataset.landingDestination,
  label: element.dataset.landingLabel,
});

export default function LandingAnalytics() {
  useEffect(() => {
    const handleClick = (event) => {
      const target = event.target.closest?.("[data-landing-event]");
      if (!target) return;

      trackGoal(target.dataset.landingEvent, getDatasetParams(target));
    };

    document.addEventListener("click", handleClick);

    const viewedSections = new Set();
    const sections = document.querySelectorAll("[data-landing-section]");
    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              const section = entry.target.dataset.landingSection;
              if (!entry.isIntersecting || !section || viewedSections.has(section)) return;

              viewedSections.add(section);
              trackGoal("landing_section_viewed", { section });
              observer?.unobserve(entry.target);
            });
          },
          { threshold: 0.35 }
        );

    sections.forEach((section) => observer?.observe(section));

    return () => {
      document.removeEventListener("click", handleClick);
      observer?.disconnect();
    };
  }, []);

  return null;
}

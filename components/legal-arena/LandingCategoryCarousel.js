"use client";

import { useState } from "react";
import * as HeroIcons from "@heroicons/react/24/outline";
import { LEGAL_CASE_CATEGORIES } from "@/libs/game/categories";
import { trackGoal } from "@/libs/datafast";

const categoryIconMap = {
  "current-events": HeroIcons.NewspaperIcon,
  "rental-dispute": HeroIcons.BuildingOffice2Icon,
  "marital-dispute": HeroIcons.HeartIcon,
  "business-dispute": HeroIcons.BriefcaseIcon,
  "contract-violation": HeroIcons.DocumentCheckIcon,
  employment: HeroIcons.IdentificationIcon,
  property: HeroIcons.HomeModernIcon,
  "personal-injury": HeroIcons.PlusCircleIcon,
  consumer: HeroIcons.ShoppingBagIcon,
  criminal: HeroIcons.ShieldExclamationIcon,
  administrative: HeroIcons.ClipboardDocumentCheckIcon,
};

const categoryMatterLabel = {
  "current-events": "Live headline matters",
  "rental-dispute": "Rental matters",
  "marital-dispute": "Family matters",
  "business-dispute": "Business matters",
  "contract-violation": "Contract matters",
  employment: "Employment matters",
  property: "Property matters",
  "personal-injury": "Injury matters",
  consumer: "Consumer matters",
  criminal: "Criminal matters",
  administrative: "Agency matters",
};

const getWrappedCategory = (index) => {
  const total = LEGAL_CASE_CATEGORIES.length;
  return LEGAL_CASE_CATEGORIES[(index + total) % total];
};

const CategoryCard = ({ category, isActive = false, onClick }) => {
  const CategoryIcon = categoryIconMap[category.slug] || HeroIcons.Squares2X2Icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`arena-surface-soft flex h-full min-h-[15rem] w-full flex-col items-center justify-between p-5 text-center transition hover:-translate-y-0.5 hover:border-amber-200/24 ${
        isActive
          ? "!border-amber-200/18 bg-amber-200/[0.052]"
          : "!border-white/[0.055] bg-white/[0.02]"
      }`}
    >
      <div>
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl border ${
            isActive
              ? "border-amber-200/20 bg-amber-200/[0.075] text-amber-100"
              : "border-amber-200/10 bg-amber-200/[0.035] text-amber-100/72"
          }`}
        >
          <CategoryIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="mt-5 text-lg font-semibold text-white">{category.title}</p>
        <p className="mt-3 text-sm leading-6 text-white/50">{category.description}</p>
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100/58">
        {categoryMatterLabel[category.slug] || "Case track"}
      </p>
    </button>
  );
};

export default function LandingCategoryCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const total = LEGAL_CASE_CATEGORIES.length;
  const activeCategory = getWrappedCategory(activeIndex);
  const previousCategory = getWrappedCategory(activeIndex - 1);
  const nextCategory = getWrappedCategory(activeIndex + 1);

  const selectCategory = (index, source) => {
    const nextIndex = (index + total) % total;
    const category = getWrappedCategory(nextIndex);
    setActiveIndex(nextIndex);
    trackGoal("landing_case_category_selected", {
      category: category.slug,
      source,
    });
  };

  const goToPrevious = (source = "previous_arrow") => {
    selectCategory(activeIndex - 1, source);
  };

  const goToNext = (source = "next_arrow") => {
    selectCategory(activeIndex + 1, source);
  };

  return (
    <div className="mt-12" aria-label="Legal Arena case categories">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          className="arena-btn-dark flex h-11 w-11 items-center justify-center !border-white/[0.075] p-0"
          onClick={() => goToPrevious()}
          aria-label="Show previous category"
        >
          <HeroIcons.ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-[0.8fr_1.15fr_0.8fr]">
          <div className="hidden opacity-60 md:block">
            <CategoryCard
              category={previousCategory}
              onClick={() => goToPrevious("previous_card")}
            />
          </div>
          <CategoryCard
            category={activeCategory}
            isActive
            onClick={() => {}}
          />
          <div className="hidden opacity-60 md:block">
            <CategoryCard
              category={nextCategory}
              onClick={() => goToNext("next_card")}
            />
          </div>
        </div>

        <button
          type="button"
          className="arena-btn-dark flex h-11 w-11 items-center justify-center !border-white/[0.075] p-0"
          onClick={() => goToNext()}
          aria-label="Show next category"
        >
          <HeroIcons.ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {LEGAL_CASE_CATEGORIES.map((category, index) => {
          const CategoryIcon = categoryIconMap[category.slug] || HeroIcons.Squares2X2Icon;
          const selected = index === activeIndex;

          return (
            <button
              key={category.slug}
              type="button"
              className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                selected
                  ? "border-amber-200/20 bg-amber-200/[0.07] text-amber-100"
                  : "border-white/[0.055] bg-white/[0.018] text-white/45 hover:border-white/10 hover:text-white/72"
              }`}
              onClick={() => selectCategory(index, "category_picker")}
              aria-label={`Show ${category.title}`}
              aria-pressed={selected}
            >
              <CategoryIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

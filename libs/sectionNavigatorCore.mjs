export const SECTION_NAVIGATOR_MIN_PAGE_RATIO = 1.5;
export const SECTION_NAVIGATOR_THRESHOLD_RATIO = 0.3;

export const isSectionNavigatorOverlayOpen = ({
  rendered = false,
  ariaHidden = null,
  hidden = false,
  tagName = "",
  nativeOpen = true,
} = {}) =>
  Boolean(
    rendered &&
      !hidden &&
      ariaHidden !== "true" &&
      (String(tagName).toUpperCase() !== "DIALOG" || nativeOpen)
  );

export const isSectionNavigatorLongPage = ({
  viewportHeight = 0,
  scrollHeight = 0,
  minPageRatio = SECTION_NAVIGATOR_MIN_PAGE_RATIO,
} = {}) =>
  Number(viewportHeight) > 0 &&
  Number(scrollHeight) >= Number(viewportHeight) * Number(minPageRatio);

export const getSectionNavigatorActiveIndex = (
  sectionTops = [],
  {
    viewportHeight = 0,
    scrollY = 0,
    scrollHeight = 0,
    thresholdRatio = SECTION_NAVIGATOR_THRESHOLD_RATIO,
    bottomTolerance = 8,
  } = {}
) => {
  if (!sectionTops.length) return -1;

  if (
    Number(scrollHeight) > 0 &&
    Number(scrollY) + Number(viewportHeight) >=
      Number(scrollHeight) - Number(bottomTolerance)
  ) {
    return sectionTops.length - 1;
  }

  const threshold = Number(viewportHeight) * Number(thresholdRatio);
  let activeIndex = 0;

  sectionTops.forEach((top, index) => {
    if (Number(top) <= threshold) {
      activeIndex = index;
    }
  });

  return activeIndex;
};

export const shouldShowSectionNavigator = ({
  mobile = false,
  modalOpen = false,
  sectionCount = 0,
  viewportHeight = 0,
  scrollHeight = 0,
  minimumSections = 3,
} = {}) =>
  Boolean(
    mobile &&
      !modalOpen &&
      Number(sectionCount) >= Number(minimumSections) &&
      isSectionNavigatorLongPage({ viewportHeight, scrollHeight })
  );

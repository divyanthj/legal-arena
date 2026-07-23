export const GUIDED_MOBILE_MEDIA_QUERY = "(max-width: 1279px)";
export const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

export const GUIDED_HAPTIC_PATTERNS = Object.freeze({
  selection: 8,
  success: 20,
  warning: Object.freeze([10, 35, 10]),
});

const resolveNode = (value) => {
  if (typeof value === "function") {
    return value();
  }

  if (value && typeof value === "object" && "current" in value) {
    return value.current;
  }

  return value;
};

const getWindow = (windowObject) =>
  windowObject || (typeof window !== "undefined" ? window : null);

export const isGuidedMobileViewport = (windowObject) => {
  const activeWindow = getWindow(windowObject);
  if (!activeWindow) return false;

  if (typeof activeWindow.matchMedia === "function") {
    return activeWindow.matchMedia(GUIDED_MOBILE_MEDIA_QUERY).matches;
  }

  return Number(activeWindow.innerWidth || 0) < 1280;
};

export const prefersReducedMotion = (windowObject) => {
  const activeWindow = getWindow(windowObject);
  return Boolean(
    activeWindow?.matchMedia?.(REDUCED_MOTION_MEDIA_QUERY)?.matches
  );
};

export const pulseHaptic = (kind = "selection", windowObject) => {
  const activeWindow = getWindow(windowObject);
  const pattern = GUIDED_HAPTIC_PATTERNS[kind];

  if (
    !pattern ||
    !isGuidedMobileViewport(activeWindow) ||
    typeof activeWindow?.navigator?.vibrate !== "function"
  ) {
    return false;
  }

  try {
    return activeWindow.navigator.vibrate(
      Array.isArray(pattern) ? [...pattern] : pattern
    );
  } catch {
    return false;
  }
};

export const isRenderedGuidedTarget = (target, windowObject) => {
  if (!target || typeof target.getBoundingClientRect !== "function") {
    return false;
  }

  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const activeWindow = getWindow(windowObject);
  const style = activeWindow?.getComputedStyle?.(target);
  return !style || (style.display !== "none" && style.visibility !== "hidden");
};

export const findVisibleGuidedTarget = (
  step,
  {
    root,
    windowObject,
    attribute = "data-guided-step",
  } = {}
) => {
  const activeWindow = getWindow(windowObject);
  const searchRoot =
    resolveNode(root) || activeWindow?.document || null;

  if (!searchRoot?.querySelectorAll) return null;

  return (
    [...searchRoot.querySelectorAll(`[${attribute}]`)].find(
      (target) =>
        target.getAttribute(attribute) === step &&
        isRenderedGuidedTarget(target, activeWindow)
    ) || null
  );
};

const getViewportBounds = (windowObject, container, topPadding, bottomPadding) => {
  if (container?.getBoundingClientRect) {
    const rect = container.getBoundingClientRect();
    return {
      top: rect.top + topPadding,
      bottom: rect.bottom - bottomPadding,
    };
  }

  return {
    top: topPadding,
    bottom: Number(windowObject?.innerHeight || 0) - bottomPadding,
  };
};

export const isGuidedTargetComfortablyVisible = (
  target,
  {
    container,
    windowObject,
    topPadding = 96,
    bottomPadding = 88,
  } = {}
) => {
  const activeWindow = getWindow(windowObject);
  if (!isRenderedGuidedTarget(target, activeWindow)) return false;

  const rect = target.getBoundingClientRect();
  const bounds = getViewportBounds(
    activeWindow,
    resolveNode(container),
    topPadding,
    bottomPadding
  );
  const availableHeight = Math.max(0, bounds.bottom - bounds.top);

  if (rect.height <= availableHeight) {
    return rect.top >= bounds.top && rect.bottom <= bounds.bottom;
  }

  return rect.top <= bounds.top && rect.bottom >= bounds.bottom;
};

export const scrollGuidedTarget = (
  target,
  {
    container,
    windowObject,
    behavior,
    topPadding = 96,
    bottomPadding = 88,
  } = {}
) => {
  const activeWindow = getWindow(windowObject);
  const activeContainer = resolveNode(container);
  if (!activeWindow || !target) return false;

  if (
    isGuidedTargetComfortablyVisible(target, {
      container: activeContainer,
      windowObject: activeWindow,
      topPadding,
      bottomPadding,
    })
  ) {
    return false;
  }

  const scrollBehavior =
    behavior || (prefersReducedMotion(activeWindow) ? "auto" : "smooth");
  const targetRect = target.getBoundingClientRect();

  if (
    activeContainer &&
    activeContainer !== activeWindow.document &&
    typeof activeContainer.scrollTo === "function"
  ) {
    const containerRect = activeContainer.getBoundingClientRect();
    const nextTop =
      Number(activeContainer.scrollTop || 0) +
      targetRect.top -
      containerRect.top -
      topPadding;
    activeContainer.scrollTo({
      top: Math.max(0, nextTop),
      behavior: scrollBehavior,
    });
    return true;
  }

  if (typeof activeWindow.scrollTo === "function") {
    activeWindow.scrollTo({
      left: Number(activeWindow.scrollX || 0),
      top: Math.max(
        0,
        Number(activeWindow.scrollY || 0) + targetRect.top - topPadding
      ),
      behavior: scrollBehavior,
    });
    return true;
  }

  return false;
};

export const createGuidedInteractionController = ({
  root,
  container,
  windowObject,
  topPadding,
  bottomPadding,
} = {}) => {
  let scheduledFrames = [];
  let fallbackTimers = [];

  const activeWindow = () => getWindow(resolveNode(windowObject));

  const cancel = () => {
    const currentWindow = activeWindow();
    scheduledFrames.forEach((frame) => currentWindow?.cancelAnimationFrame?.(frame));
    fallbackTimers.forEach((timer) => clearTimeout(timer));
    scheduledFrames = [];
    fallbackTimers = [];
  };

  const scheduleFrame = (callback) => {
    const currentWindow = activeWindow();
    if (typeof currentWindow?.requestAnimationFrame === "function") {
      const frame = currentWindow.requestAnimationFrame(callback);
      scheduledFrames.push(frame);
      return;
    }

    const timer = setTimeout(callback, 0);
    fallbackTimers.push(timer);
  };

  const advance = (step, options = {}) => {
    const currentWindow = activeWindow();
    if (!step || !isGuidedMobileViewport(currentWindow)) return false;

    cancel();
    scheduleFrame(() => {
      scheduleFrame(() => {
        scheduledFrames = [];
        fallbackTimers = [];
        const target = findVisibleGuidedTarget(step, {
          root: options.root || root,
          windowObject: currentWindow,
        });
        if (!target) return;

        scrollGuidedTarget(target, {
          container: options.container || container,
          windowObject: currentWindow,
          behavior: options.behavior,
          topPadding: options.topPadding ?? topPadding,
          bottomPadding: options.bottomPadding ?? bottomPadding,
        });
      });
    });
    return true;
  };

  return {
    advance,
    cancel,
    pulse: (kind) => pulseHaptic(kind, activeWindow()),
  };
};

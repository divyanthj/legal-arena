import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  GUIDED_HAPTIC_PATTERNS,
  createGuidedInteractionController,
  findVisibleGuidedTarget,
  isGuidedMobileViewport,
  isGuidedTargetComfortablyVisible,
  prefersReducedMotion,
  pulseHaptic,
  scrollGuidedTarget,
} from "../libs/guidedInteractionCore.mjs";

const makeWindow = ({
  mobile = true,
  reducedMotion = false,
  innerHeight = 800,
} = {}) => {
  const vibrations = [];
  const scrolls = [];
  const frames = new Map();
  let nextFrame = 1;

  const windowObject = {
    innerWidth: mobile ? 820 : 1280,
    innerHeight,
    scrollX: 0,
    scrollY: 0,
    navigator: {
      vibrate(pattern) {
        vibrations.push(pattern);
        return true;
      },
    },
    document: null,
    matchMedia(query) {
      return {
        matches: query.includes("max-width") ? mobile : reducedMotion,
      };
    },
    getComputedStyle() {
      return { display: "block", visibility: "visible" };
    },
    scrollTo(options) {
      scrolls.push(options);
    },
    requestAnimationFrame(callback) {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  };

  const flushFrames = () => {
    while (frames.size) {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback());
    }
  };

  return { windowObject, vibrations, scrolls, flushFrames };
};

const makeTarget = (step, rect) => ({
  getAttribute(name) {
    return name === "data-guided-step" ? step : null;
  },
  getBoundingClientRect() {
    return { ...rect };
  },
});

assert.equal(isGuidedMobileViewport(makeWindow({ mobile: true }).windowObject), true);
assert.equal(isGuidedMobileViewport(makeWindow({ mobile: false }).windowObject), false);
assert.equal(prefersReducedMotion(makeWindow({ reducedMotion: true }).windowObject), true);

{
  const { windowObject, vibrations } = makeWindow();
  assert.equal(pulseHaptic("selection", windowObject), true);
  assert.equal(pulseHaptic("success", windowObject), true);
  assert.equal(pulseHaptic("warning", windowObject), true);
  assert.deepEqual(vibrations, [
    GUIDED_HAPTIC_PATTERNS.selection,
    GUIDED_HAPTIC_PATTERNS.success,
    [...GUIDED_HAPTIC_PATTERNS.warning],
  ]);
}

{
  const { windowObject, vibrations } = makeWindow({ mobile: false });
  assert.equal(pulseHaptic("selection", windowObject), false);
  assert.deepEqual(vibrations, []);
  assert.equal(
    pulseHaptic("selection", { ...windowObject, navigator: {} }),
    false
  );
}

{
  const { windowObject } = makeWindow();
  windowObject.navigator.vibrate = () => {
    throw new Error("not permitted");
  };
  assert.equal(pulseHaptic("selection", windowObject), false);
}

{
  const { windowObject } = makeWindow();
  const hidden = makeTarget("difficulty", {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
  });
  const visible = makeTarget("difficulty", {
    top: 300,
    bottom: 420,
    left: 0,
    right: 300,
    width: 300,
    height: 120,
  });
  const root = { querySelectorAll: () => [hidden, visible] };
  assert.equal(
    findVisibleGuidedTarget("difficulty", { root, windowObject }),
    visible
  );
  assert.equal(
    isGuidedTargetComfortablyVisible(visible, { windowObject }),
    true
  );
}

{
  const { windowObject, scrolls } = makeWindow({ reducedMotion: true });
  const target = makeTarget("preview", {
    top: 720,
    bottom: 880,
    left: 0,
    right: 300,
    width: 300,
    height: 160,
  });
  assert.equal(scrollGuidedTarget(target, { windowObject }), true);
  assert.equal(scrolls[0].behavior, "auto");
  assert.equal(scrolls[0].top, 624);
}

{
  const { windowObject, scrolls } = makeWindow();
  const target = makeTarget("preview", {
    top: 300,
    bottom: 420,
    left: 0,
    right: 300,
    width: 300,
    height: 120,
  });
  assert.equal(scrollGuidedTarget(target, { windowObject }), false);
  assert.deepEqual(scrolls, []);
}

{
  const { windowObject } = makeWindow();
  const containerScrolls = [];
  const container = {
    scrollTop: 100,
    getBoundingClientRect: () => ({
      top: 100,
      bottom: 700,
      left: 0,
      right: 400,
      width: 400,
      height: 600,
    }),
    scrollTo(options) {
      containerScrolls.push(options);
    },
  };
  const target = makeTarget("summary", {
    top: 650,
    bottom: 850,
    left: 0,
    right: 300,
    width: 300,
    height: 200,
  });
  assert.equal(
    scrollGuidedTarget(target, {
      container,
      windowObject,
      topPadding: 24,
      bottomPadding: 72,
    }),
    true
  );
  assert.deepEqual(containerScrolls[0], {
    top: 626,
    behavior: "smooth",
  });
}

{
  const { windowObject, scrolls, flushFrames } = makeWindow();
  const first = makeTarget("first", {
    top: 720,
    bottom: 820,
    left: 0,
    right: 300,
    width: 300,
    height: 100,
  });
  const second = makeTarget("second", {
    top: 760,
    bottom: 860,
    left: 0,
    right: 300,
    width: 300,
    height: 100,
  });
  const root = { querySelectorAll: () => [first, second] };
  const controller = createGuidedInteractionController({
    root,
    windowObject,
  });
  controller.advance("first");
  controller.advance("second");
  flushFrames();
  assert.equal(scrolls.length, 1);
  assert.equal(scrolls[0].top, 664);
  controller.cancel();
}

const [dashboardSource, challengeSource, workspaceSource] = await Promise.all([
  readFile(new URL("../components/legal-arena/DashboardHub.js", import.meta.url), "utf8"),
  readFile(new URL("../components/legal-arena/ChallengeButton.js", import.meta.url), "utf8"),
  readFile(new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url), "utf8"),
]);

assert.match(dashboardSource, /advance\("solo-category"\)/);
assert.match(dashboardSource, /advance\("solo-difficulty"\)/);
assert.match(dashboardSource, /advance\("solo-preview"\)/);
assert.match(
  dashboardSource,
  /preserveScrollPosition[\s\S]*!isGuidedMobileViewport\(window\)/
);
assert.match(dashboardSource, /if \(locked\) \{[\s\S]*pulse\("warning"\)/);

assert.match(challengeSource, /ref=\{modalScrollRef\}/);
assert.match(challengeSource, /advance\("pvp-category"\)/);
assert.match(challengeSource, /advance\("pvp-difficulty"\)/);
assert.match(challengeSource, /advance\("pvp-summary"\)/);

assert.match(workspaceSource, /advance\("intake-composer"\)/);
assert.match(workspaceSource, /advance\("courtroom-composer"\)/);
assert.match(
  workspaceSource,
  /isDefendantSide[\s\S]*"courtroom-opponent-opening"[\s\S]*"courtroom-entry-composer"/
);
assert.match(
  workspaceSource,
  /data-guided-step="courtroom-opponent-opening"/
);
assert.match(
  workspaceSource,
  /data-guided-step="courtroom-entry-composer"/
);
assert.match(
  workspaceSource,
  /courtroomEntryGuidanceKeyRef\.current === guidanceKey/
);
assert.match(workspaceSource, /advance\("settlement-client-composer"\)/);
assert.match(workspaceSource, /advance\("settlement-decision"\)/);
assert.doesNotMatch(workspaceSource, /triggerSettlementHaptic/);
assert.doesNotMatch(workspaceSource, /onPointerDown=\{[^}]*Haptic/);
assert.match(
  workspaceSource,
  /showMobileFactSheetDialog[\s\S]*modal-box flex max-h-\[90dvh\] w-full flex-col/
);
assert.match(
  workspaceSource,
  /Case file reference[\s\S]*mt-4 grid grid-cols-4 gap-2/
);
assert.doesNotMatch(
  workspaceSource,
  /Case file reference[\s\S]*snap-x gap-2 overflow-x-auto/
);
assert.match(
  workspaceSource,
  /arena-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain/
);
assert.doesNotMatch(workspaceSource, /min-h-\[21\.25rem\]/);

console.log("Guided interaction tests passed.");

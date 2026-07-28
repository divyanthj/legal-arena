import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const [
  welcomeSource,
  dashboardSource,
  globalStyles,
  onboardingSource,
  welcomeRouteSource,
  userModelSource,
] =
  await Promise.all([
    readFile(
      new URL(
        "../components/legal-arena/DashboardWelcomeModal.js",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL("../components/legal-arena/DashboardHub.js", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../libs/game/onboarding.js", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../app/api/onboarding/dashboard-welcome/route.js",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(new URL("../models/User.js", import.meta.url), "utf8"),
  ]);

await Promise.all([
  access(new URL("../public/logoAndName.png", import.meta.url)),
  access(new URL("../public/images/court.jpg", import.meta.url)),
  access(
    new URL("../public/help/screenshots/case-selection.png", import.meta.url)
  ),
  access(
    new URL("../public/media/tutorials/case-intake.png", import.meta.url)
  ),
  access(new URL("../public/help/screenshots/courtroom.png", import.meta.url)),
  access(new URL("../public/help/screenshots/settlement.png", import.meta.url)),
]);

assert.match(
  welcomeSource,
  /id: "welcome"[\s\S]*Welcome to the courtroom\.[\s\S]*AI-powered courtroom game/,
);
assert.match(
  welcomeSource,
  /id: "choose"[\s\S]*Choose a case\.[\s\S]*Choose a practice area and difficulty/,
);
assert.match(
  welcomeSource,
  /id: "build"[\s\S]*Interview your client\.[\s\S]*fact sheet updates automatically/,
);
assert.match(
  welcomeSource,
  /id: "resolve"[\s\S]*Settle or go to court\.[\s\S]*Happy lawyering!/,
);
assert.doesNotMatch(welcomeSource, /Read the room/);
assert.doesNotMatch(welcomeSource, />Build the case</);
assert.match(welcomeSource, /Start the quick tour/);
assert.match(
  welcomeSource,
  /onClick=\{\(\) => skipWelcome\("direct_play"\)\}[\s\S]*Or just start playing/,
);
assert.match(welcomeSource, /: "Skip"/);
assert.match(welcomeSource, /Don’t show again/);
assert.match(welcomeSource, /src="\/logoAndName\.png"/);
assert.match(welcomeSource, /doNotShowAgainInitially = false/);
assert.match(
  welcomeSource,
  /onStartTour\?\.\(\{ doNotShowAgain \}\)/
);
assert.match(welcomeSource, /onSkip\?\.\(\{ doNotShowAgain \}\)/);
assert.match(welcomeSource, /onTouchStart=\{handleTouchStart\}/);
assert.match(welcomeSource, /event\.key === "ArrowRight"/);
assert.match(
  welcomeSource,
  /event\.key === "ArrowRight"[\s\S]*activeIndex === dashboardWelcomeSlides\.length - 1[\s\S]*startTour\("keyboard_final_next"\)/
);
assert.match(welcomeSource, /event\.key === "ArrowLeft"/);
assert.match(welcomeSource, /dialog\.showModal\(\)/);
assert.match(welcomeSource, /aria-labelledby="dashboard-welcome-title"/);
assert.match(welcomeSource, /aria-describedby="dashboard-welcome-description"/);
assert.match(
  welcomeSource,
  /event\.preventDefault\(\);[\s\S]*skipWelcome\("escape"\)/
);
assert.match(welcomeSource, /role="alert"/);
assert.match(welcomeSource, /prefers-reduced-motion: reduce/);
assert.match(welcomeSource, /dashboard_welcome_viewed/);
assert.match(welcomeSource, /dashboard_welcome_slide_viewed/);
assert.match(welcomeSource, /dashboard_welcome_slide_changed/);
assert.match(welcomeSource, /dashboard_welcome_skipped/);
assert.match(welcomeSource, /dashboard_welcome_direct_play_started/);
assert.match(welcomeSource, /dashboard_welcome_completed/);
assert.match(welcomeSource, /dashboard_welcome_tour_started/);
assert.match(
  welcomeSource,
  /onClick=\{\(\) => \{[\s\S]*activeIndex === dashboardWelcomeSlides\.length - 1[\s\S]*startTour\("final_next"\)[\s\S]*Start the dashboard tour/
);

assert.match(
  dashboardSource,
  /onboarding\?\.dashboardWelcomeDismissed \? "closed" : "welcome"/
);
assert.match(
  dashboardSource,
  /setDashboardOnboardingSource\(source\);[\s\S]*setDashboardOnboardingStage\("welcome"\)/
);
assert.match(
  dashboardSource,
  /apiClient\.post\("\/onboarding\/dashboard-tutorial"\)[\s\S]*setDashboardOnboardingStage\("closed"\)/
);
assert.match(
  dashboardSource,
  /apiClient\.post\("\/onboarding\/dashboard-welcome",[\s\S]*doNotShowAgain[\s\S]*setDashboardWelcomeDismissed/
);
assert.match(
  dashboardSource,
  /<DashboardWelcomeModal[\s\S]*dashboardOnboardingStage === "welcome"[\s\S]*doNotShowAgainInitially=\{dashboardWelcomeDismissed\}[\s\S]*onStartTour=\{startDashboardTourFromWelcome\}/
);
assert.match(
  dashboardSource,
  /<DashboardOnboardingOverlay[\s\S]*dashboardOnboardingStage === "tour"[\s\S]*completeDashboardOnboarding/
);
assert.match(dashboardSource, /requestDashboardOnboarding\("desktop_hero"\)/);
assert.match(
  dashboardSource,
  /requestDashboardOnboarding\("mobile_activation_card"\)/
);
assert.match(
  dashboardSource,
  /!hasArenaAccess[\s\S]*source="dashboard_desktop_rail"[\s\S]*ariaLabel="Purchase Legal Arena"/
);
assert.match(
  dashboardSource,
  /label: "Cases"[\s\S]*label: "Upgrade"[\s\S]*label: "Ranks"[\s\S]*source="dashboard_mobile_nav"[\s\S]*ariaLabel="Upgrade Legal Arena"[\s\S]*contentClassName="flex flex-col items-center justify-center gap-1"/
);
assert.match(dashboardSource, /dashboard_welcome_preference_saved/);
assert.match(dashboardSource, /dashboard_upgrade_viewed/);
assert.match(
  dashboardSource,
  /dashboard_upgrade_clicked[\s\S]*surface: "desktop_rail"/
);
assert.match(
  dashboardSource,
  /dashboard_upgrade_clicked[\s\S]*surface: "mobile_bottom_nav"/
);
assert.match(dashboardSource, /tour_completion_saved/);
assert.match(dashboardSource, /tour_completion_failed/);
assert.doesNotMatch(dashboardSource, /isOpen=\{!dashboardTutorialCompleted\}/);

assert.match(onboardingSource, /dashboardWelcomeDismissed: false/);
assert.match(
  onboardingSource,
  /setDashboardWelcomePreferenceForUser[\s\S]*dashboardWelcomeDismissed/
);
assert.match(welcomeRouteSource, /doNotShowAgain: Boolean\(body\?\.doNotShowAgain\)/);
assert.match(userModelSource, /dashboardWelcomeDismissed:[\s\S]*default: false/);
assert.match(globalStyles, /\.arena-welcome-shell/);
assert.match(
  dashboardSource,
  /arena-purchase-rail[\s\S]*border-0 bg-\[linear-gradient\(145deg[\s\S]*text-amber-200/
);
assert.match(
  globalStyles,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.arena-welcome-slide-forward/
);

console.log("Dashboard welcome tests passed");

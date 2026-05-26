export const dashboardTutorialSteps = [
  {
    eyebrow: "Live Dashboard",
    title: "Select a brand-new live dispute",
    body: "This run starts from the Command dashboard, where we ignored older open matters and picked a fresh live dispute from the case library instead.",
    accent: "#ff8f3d",
    imageSrc: "media/tutorials/dashboard-live-dispute.png",
    imageAlt: "Legal Arena dashboard with live disputes",
    metrics: [
      "Start from the Command home screen",
      "Browse the live dispute library",
      "Avoid continuing an already-open case",
    ],
  },
  {
    eyebrow: "Court-Ready File",
    title: "Finalize once the win chance clears 50%",
    body: "Inside the new Unpaid Consulting Fee Dispute, the fact sheet reached court-ready status at 68% chance, so we finalized the file and moved directly into the courtroom.",
    accent: "#58c3ff",
    imageSrc: "media/tutorials/case-verdict-top.png",
    imageAlt: "Legal Arena case workspace with court-ready fact sheet",
    metrics: [
      "Business dispute in small claims court",
      "Plaintiff-side file at 68% chance",
      "Fact sheet, lawbook, and bench signal visible together",
    ],
  },
  {
    eyebrow: "Courtroom Duel",
    title: "Argue through all three rounds",
    body: "The courtroom phase pushed the case through three argument rounds focused on the email agreement, the unpaid invoice, and whether the record proved completion strongly enough for payment.",
    accent: "#7ef0c7",
    imageSrc: "media/tutorials/case-courtroom-middle.png",
    imageAlt: "Legal Arena courtroom transcript during the final round",
    metrics: [
      "Three-round AI courtroom exchange",
      "Opponent rebuttals surfaced proof gaps",
      "Lawbook rules stayed visible during argument",
    ],
  },
  {
    eyebrow: "Verdict Screen",
    title: "Reach the final ruling",
    body: "The run completed at the verdict screen with a detailed ruling summary. It also exposed a state inconsistency worth fixing: the badge says 'You Prevailed' while the written ruling denies judgment on the present record.",
    accent: "#8cf07a",
    imageSrc: "media/tutorials/case-final-ruling.png",
    imageAlt: "Legal Arena final ruling view",
    metrics: [
      "Verdict breakdown explains strengths and weaknesses",
      "Ruling view closes the live dispute loop",
      "Real playthrough surfaced a result-state bug",
    ],
  },
];

export const tutorialVideoDefaults = {
  title: "Legal Arena New Live Dispute Run",
  subtitle: "A real playthrough from dashboard selection to courtroom verdict",
  fps: 30,
  width: 1920,
  height: 1080,
  stepFrames: 135,
  introFrames: 75,
  outroFrames: 60,
  logoSrc: "logoAndName.png",
  steps: dashboardTutorialSteps,
};

tutorialVideoDefaults.durationInFrames =
  tutorialVideoDefaults.introFrames +
  tutorialVideoDefaults.steps.length * tutorialVideoDefaults.stepFrames +
  tutorialVideoDefaults.outroFrames;

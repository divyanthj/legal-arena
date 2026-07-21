import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const COLORS = {
  black: "#030504",
  cream: "#fff8e8",
  gold: "#f3d273",
  green: "#43df8d",
  muted: "rgba(255,248,232,.68)",
};

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
};

const reveal = (frame, start, end) =>
  interpolate(frame, [start, end], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

const Grain = () => (
  <AbsoluteFill
    style={{
      opacity: 0.065,
      mixBlendMode: "screen",
      pointerEvents: "none",
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.88' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E\")",
    }}
  />
);

const MobileCapture = ({ image, top = 160, scale = 1 }) => (
  <Img
    src={staticFile(`media/promo-v3/${image}`)}
    style={{
      position: "absolute",
      left: 0,
      top,
      width: 1080,
      height: 2341,
      objectFit: "fill",
      transform: `scale(${scale})`,
      transformOrigin: "center 820px",
    }}
  />
);

const Vignette = ({ strong = false }) => (
  <>
    <AbsoluteFill
      style={{
        background: strong
          ? "linear-gradient(180deg, rgba(3,5,4,.96) 0%, rgba(3,5,4,.54) 26%, rgba(3,5,4,.08) 52%, rgba(3,5,4,.42) 100%)"
          : "linear-gradient(180deg, rgba(3,5,4,.92) 0%, rgba(3,5,4,.2) 27%, rgba(3,5,4,.05) 68%, rgba(3,5,4,.5) 100%)",
      }}
    />
    <AbsoluteFill style={{ boxShadow: "inset 0 0 130px rgba(0,0,0,.62)" }} />
  </>
);

const Brand = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <div
      style={{
        width: 43,
        height: 43,
        borderRadius: 12,
        display: "grid",
        placeItems: "center",
        border: "1px solid rgba(243,210,115,.38)",
        background: "rgba(255,255,255,.055)",
      }}
    >
      <Img src={staticFile("logoAndName.png")} style={{ width: 32, height: 32 }} />
    </div>
    <div style={{ fontSize: 23, fontWeight: 950, letterSpacing: "-.03em" }}>LEGAL ARENA</div>
  </div>
);

const StepRail = ({ active }) => (
  <div
    style={{
      position: "absolute",
      left: 58,
      right: 58,
      top: 128,
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 10,
    }}
  >
    {[0, 1, 2].map((step) => (
      <div
        key={step}
        style={{
          height: 5,
          borderRadius: 99,
          background: step <= active ? COLORS.gold : "rgba(255,255,255,.12)",
          boxShadow: step === active ? `0 0 16px ${COLORS.gold}88` : "none",
        }}
      />
    ))}
  </div>
);

const TypingScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const question = "Do you have any photos taken right after Nina moved out?";
  const typedProgress = interpolate(frame, [62, 210], [0, question.length], clamp);
  const typedText = question.slice(0, Math.floor(typedProgress));
  const hookIn = reveal(frame, 4, 18);
  const promptIn = reveal(frame, 48, 64);
  const phoneIn = spring({ frame, fps, config: { damping: 16, stiffness: 105, mass: .9 } });
  const tapIn = reveal(frame, 213, 223);
  const cursorVisible = Math.floor(frame / 8) % 2 === 0;
  const sendPulse = frame > 210 ? 1 + Math.sin((frame - 210) / 3) * .018 : 1;

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: COLORS.black, color: COLORS.cream, fontFamily: "Inter, Arial, sans-serif" }}>
      <div style={{ opacity: phoneIn, transform: `translateY(${interpolate(phoneIn, [0, 1], [54, 0])}px)` }}>
        <MobileCapture image="13-photo-question-typed.png" />
      </div>
      <Vignette strong />

      <div style={{ position: "absolute", left: 58, top: 51 }}>
        <Brand />
      </div>
      <StepRail active={0} />

      <div
        style={{
          position: "absolute",
          left: 58,
          right: 58,
          top: 181,
          opacity: hookIn,
          transform: `translateY(${interpolate(hookIn, [0, 1], [32, 0])}px)`,
        }}
      >
        <div style={{ color: COLORS.gold, fontSize: 18, fontWeight: 950, letterSpacing: ".22em" }}>
          THIS IS THE GAME
        </div>
        <div style={{ marginTop: 17, fontSize: 75, lineHeight: .93, fontWeight: 950, letterSpacing: "-.06em" }}>
          NO DIALOGUE
          <br />
          OPTIONS.
        </div>
        <div style={{ marginTop: 20, color: COLORS.muted, fontSize: 26, opacity: promptIn }}>
          Type the question you actually want to ask.
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 92,
          top: 808,
          width: 823,
          height: 234,
          borderRadius: 31,
          background: "#111614",
          border: `2px solid ${frame > 54 ? COLORS.gold : "rgba(255,255,255,.12)"}`,
          boxShadow: frame > 54 ? "0 0 0 6px rgba(243,210,115,.07), 0 0 36px rgba(243,210,115,.16)" : "none",
          padding: "39px 42px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 35, lineHeight: 1.48, fontWeight: 560, letterSpacing: "-.02em" }}>
          {typedText}
          <span style={{ opacity: cursorVisible ? 1 : 0, color: COLORS.gold }}>|</span>
        </div>
        <div
          style={{
            position: "absolute",
            right: 25,
            bottom: 24,
            width: 54,
            height: 54,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,.13)",
            display: "grid",
            placeItems: "center",
            color: "rgba(255,255,255,.5)",
            fontSize: 22,
          }}
        >
          ●
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 70,
          top: 1107,
          width: 866,
          height: 111,
          borderRadius: 25,
          border: frame > 205 ? `3px solid ${COLORS.cream}` : "3px solid transparent",
          boxShadow: frame > 205 ? "0 0 35px rgba(255,248,232,.2)" : "none",
          transform: `scale(${sendPulse})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 496,
          top: 1128,
          width: 90,
          height: 90,
          borderRadius: "50%",
          border: `4px solid ${COLORS.cream}`,
          opacity: tapIn,
          transform: `scale(${interpolate(tapIn, [0, 1], [.2, 1.8])})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 82,
          textAlign: "center",
          color: "rgba(255,255,255,.48)",
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: ".16em",
        }}
      >
        REAL MOBILE GAMEPLAY
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

const ThinkingScene = () => {
  const frame = useCurrentFrame();
  const enter = reveal(frame, 0, 12);
  const scale = interpolate(frame, [0, 165], [1.03, 1.075], clamp);
  const dot = Math.floor(frame / 15) % 3;

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: COLORS.black, color: COLORS.cream, fontFamily: "Inter, Arial, sans-serif" }}>
      <MobileCapture image="14-photo-question-submitting.png" top={160} scale={scale} />
      <Vignette />
      <div style={{ position: "absolute", left: 58, top: 51 }}>
        <Brand />
      </div>
      <StepRail active={1} />
      <div
        style={{
          position: "absolute",
          left: 58,
          right: 58,
          top: 181,
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [28, 0])}px)`,
        }}
      >
        <div style={{ color: COLORS.green, fontSize: 18, fontWeight: 950, letterSpacing: ".22em" }}>
          YOUR WORDS WENT IN
        </div>
        <div style={{ marginTop: 16, fontSize: 70, lineHeight: .94, fontWeight: 950, letterSpacing: "-.06em" }}>
          THE AI CLIENT
          <br />
          IS ANSWERING<span style={{ color: COLORS.gold }}>{".".repeat(dot + 1)}</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 99,
          top: 472,
          width: 807,
          height: 327,
          borderRadius: 35,
          border: `3px solid ${COLORS.gold}`,
          boxShadow: "0 0 0 7px rgba(243,210,115,.07), 0 0 46px rgba(243,210,115,.22)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 82,
          textAlign: "center",
          color: "rgba(255,255,255,.48)",
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: ".16em",
        }}
      >
        NO PRE-WRITTEN RESPONSE
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

const AnswerScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame, fps, config: { damping: 13, stiffness: 116, mass: .8 } });
  const title = reveal(frame, 6, 20);
  const answerPulse = 1 + Math.sin(frame / 7) * .006;

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: COLORS.black, color: COLORS.cream, fontFamily: "Inter, Arial, sans-serif" }}>
      <MobileCapture image="15-photo-answer.png" top={160} scale={1.055} />
      <Vignette />
      <div style={{ position: "absolute", left: 58, top: 51 }}>
        <Brand />
      </div>
      <StepRail active={2} />
      <div
        style={{
          position: "absolute",
          left: 58,
          right: 58,
          top: 181,
          opacity: title,
          transform: `translateY(${interpolate(title, [0, 1], [30, 0])}px)`,
        }}
      >
        <div style={{ color: COLORS.gold, fontSize: 18, fontWeight: 950, letterSpacing: ".22em" }}>
          AND THE ANSWER CHANGES THE CASE
        </div>
        <div style={{ marginTop: 16, fontSize: 75, lineHeight: .94, fontWeight: 950, letterSpacing: "-.06em" }}>
          “NO, NOT THAT
          <br />
          I KNOW OF.”
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 98,
          top: 470,
          width: 809,
          height: 260,
          borderRadius: 35,
          border: `3px solid ${COLORS.green}`,
          boxShadow: "0 0 0 8px rgba(67,223,141,.07), 0 0 55px rgba(67,223,141,.24)",
          opacity: card,
          transform: `scale(${card * answerPulse})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 82,
          textAlign: "center",
          color: "rgba(255,255,255,.48)",
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: ".16em",
        }}
      >
        ASK · FOLLOW UP · FIND THE TRUTH
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

const CTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 12, stiffness: 115, mass: .8 } });
  const title = reveal(frame, 8, 25);
  const button = reveal(frame, 36, 55);
  const drift = Math.sin(frame / 18) * 22;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background: "linear-gradient(155deg, #06110c 0%, #030504 55%, #110d05 100%)",
        color: COLORS.cream,
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 780,
          height: 780,
          left: -430 + drift,
          top: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(67,223,141,.3), transparent 68%)",
          filter: "blur(36px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 820,
          height: 820,
          right: -450 - drift,
          bottom: 30,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(243,210,115,.26), transparent 69%)",
          filter: "blur(42px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 185,
          width: 142,
          height: 142,
          borderRadius: 38,
          transform: `translateX(-50%) scale(${logo})`,
          display: "grid",
          placeItems: "center",
          border: "1px solid rgba(243,210,115,.48)",
          background: "linear-gradient(145deg, rgba(255,255,255,.12), rgba(255,255,255,.025))",
          boxShadow: "0 28px 80px rgba(0,0,0,.55), 0 0 48px rgba(67,223,141,.14)",
        }}
      >
        <Img src={staticFile("logoAndName.png")} style={{ width: 105, height: 105 }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 62,
          right: 62,
          top: 415,
          textAlign: "center",
          opacity: title,
          transform: `translateY(${interpolate(title, [0, 1], [45, 0])}px)`,
        }}
      >
        <div style={{ color: COLORS.gold, fontSize: 22, fontWeight: 950, letterSpacing: ".23em" }}>
          YOUR TURN
        </div>
        <div style={{ marginTop: 45, fontSize: 103, lineHeight: .93, fontWeight: 950, letterSpacing: "-.07em" }}>
          WHAT WOULD
          <br />
          <span style={{ color: COLORS.green }}>YOU</span> ASK
          <br />
          NEXT?
        </div>
        <div style={{ marginTop: 58, fontSize: 31, lineHeight: 1.38, color: COLORS.muted }}>
          No scripted dialogue.
          <br />
          Just your questions—and their answers.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 86,
          right: 86,
          bottom: 238,
          borderRadius: 25,
          padding: "29px 28px",
          background: COLORS.cream,
          color: COLORS.black,
          textAlign: "center",
          fontSize: 31,
          fontWeight: 950,
          letterSpacing: ".07em",
          opacity: button,
          transform: `translateY(${interpolate(button, [0, 1], [42, 0])}px)`,
          boxShadow: "0 24px 70px rgba(0,0,0,.5), 0 0 42px rgba(243,210,115,.18)",
        }}
      >
        PLAY YOUR FIRST CASE FREE
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 151,
          textAlign: "center",
          color: COLORS.gold,
          fontSize: 29,
          fontWeight: 950,
          letterSpacing: ".08em",
          opacity: button,
        }}
      >
        LEGALARENA.APP
      </div>
      <Grain />
    </AbsoluteFill>
  );
};

export const LegalArenaInstagramPromoV3 = () => (
  <AbsoluteFill style={{ background: COLORS.black }}>
    <Audio src={staticFile("media/legal-arena-promo-v3-sound.wav")} volume={0.95} />
    <Sequence from={0} durationInFrames={240}>
      <TypingScene />
    </Sequence>
    <Sequence from={240} durationInFrames={165}>
      <ThinkingScene />
    </Sequence>
    <Sequence from={405} durationInFrames={105}>
      <AnswerScene />
    </Sequence>
    <Sequence from={510} durationInFrames={120}>
      <CTA />
    </Sequence>
  </AbsoluteFill>
);

export const instagramPromoV3Defaults = {
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 630,
};

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
  gold: "#f1ce6c",
  green: "#39dd88",
  red: "#ff5578",
  blue: "#59c7ff",
};

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
};

const ease = (frame, from, to) =>
  interpolate(frame, [from, to], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

const Noise = () => (
  <AbsoluteFill
    style={{
      opacity: 0.07,
      mixBlendMode: "screen",
      pointerEvents: "none",
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E\")",
    }}
  />
);

const Backdrop = ({ accent = COLORS.gold, children }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 31) * 38;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background: "linear-gradient(155deg, #07100c 0%, #030504 48%, #0e0907 100%)",
        color: COLORS.cream,
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 730,
          height: 730,
          top: -270,
          right: -300 + drift,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}45 0%, transparent 69%)`,
          filter: "blur(35px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 850,
          height: 850,
          left: -460 - drift,
          bottom: -240,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(33, 173, 99, .22), transparent 68%)",
          filter: "blur(44px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.09,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "92px 92px",
          maskImage: "linear-gradient(to bottom, transparent, black 22%, black 82%, transparent)",
        }}
      />
      {children}
      <Noise />
    </AbsoluteFill>
  );
};

const MiniBrand = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <div
      style={{
        width: 45,
        height: 45,
        display: "grid",
        placeItems: "center",
        borderRadius: 12,
        border: "1px solid rgba(241,206,108,.38)",
        background: "rgba(255,255,255,.055)",
      }}
    >
      <Img src={staticFile("logoAndName.png")} style={{ width: 33, height: 33 }} />
    </div>
    <div style={{ fontSize: 24, fontWeight: 950, letterSpacing: "-.03em" }}>LEGAL ARENA</div>
  </div>
);

const Hook = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13, stiffness: 125, mass: 0.8 } });
  const reveal = ease(frame, 4, 17);
  const subReveal = ease(frame, 21, 34);
  const screenshotReveal = ease(frame, 13, 32);

  return (
    <Backdrop accent={COLORS.red}>
      <Img
        src={staticFile("media/promo-v2/34-adverse-ruling.png")}
        style={{
          position: "absolute",
          width: 900,
          height: 1950,
          objectFit: "cover",
          left: 90,
          top: 150,
          opacity: screenshotReveal * 0.2,
          filter: "blur(9px) saturate(.75)",
          transform: `scale(${interpolate(screenshotReveal, [0, 1], [1.14, 1.02])})`,
        }}
      />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(3,5,4,.2), rgba(3,5,4,.88))" }} />
      <div style={{ position: "absolute", left: 66, right: 66, top: 68 }}>
        <MiniBrand />
      </div>
      <div
        style={{
          position: "absolute",
          left: 66,
          right: 66,
          top: 435,
          transform: `scale(${interpolate(pop, [0, 1], [.9, 1])})`,
          transformOrigin: "left center",
        }}
      >
        <div
          style={{
            color: COLORS.red,
            fontSize: 22,
            fontWeight: 950,
            letterSpacing: ".23em",
            opacity: reveal,
            marginBottom: 30,
          }}
        >
          REAL GAMEPLAY · REAL VERDICT
        </div>
        <div
          style={{
            fontSize: 116,
            lineHeight: .9,
            letterSpacing: "-.075em",
            fontWeight: 950,
            opacity: reveal,
            transform: `translateY(${interpolate(reveal, [0, 1], [50, 0])}px)`,
          }}
        >
          I LOST
          <br />
          TO AN <span style={{ color: COLORS.red }}>AI</span>
          <br />
          LAWYER.
        </div>
        <div
          style={{
            width: 150,
            height: 7,
            borderRadius: 99,
            background: COLORS.green,
            boxShadow: `0 0 26px ${COLORS.green}`,
            marginTop: 56,
            transform: `scaleX(${subReveal})`,
            transformOrigin: "left",
          }}
        />
        <div
          style={{
            fontSize: 29,
            lineHeight: 1.42,
            color: "rgba(255,248,232,.72)",
            marginTop: 32,
            maxWidth: 760,
            opacity: subReveal,
          }}
        >
          The judge made me prove every claim.
          <br />
          Here’s how the case fell apart.
        </div>
      </div>
    </Backdrop>
  );
};

const PhoneCapture = ({ image, imageTwo, switchFrame, frame, accent, zoom = 1.015 }) => {
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 17, stiffness: 112, mass: 0.9 } });
  const secondOpacity = imageTwo ? ease(frame, switchFrame - 5, switchFrame + 5) : 0;
  const imageStyle = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 169,
        top: 310,
        width: 742,
        height: 1588,
        borderRadius: 50,
        background: "#050605",
        border: `1px solid ${accent}77`,
        boxShadow: "0 45px 110px rgba(0,0,0,.62), 0 0 0 10px rgba(255,255,255,.025)",
        overflow: "hidden",
        opacity: rise,
        transform: `translateY(${interpolate(rise, [0, 1], [80, 0])}px) scale(${interpolate(frame, [0, 70], [1, zoom], clamp)})`,
      }}
    >
      <Img src={staticFile(`media/promo-v2/${image}`)} style={{ ...imageStyle, opacity: 1 - secondOpacity }} />
      {imageTwo && (
        <Img src={staticFile(`media/promo-v2/${imageTwo}`)} style={{ ...imageStyle, opacity: secondOpacity }} />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 85px rgba(0,0,0,.22)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 14,
          left: "50%",
          width: 98,
          height: 24,
          borderRadius: 99,
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,.76)",
          border: "1px solid rgba(255,255,255,.08)",
        }}
      />
    </div>
  );
};

const StoryScene = ({
  number,
  label,
  title,
  image,
  imageTwo,
  switchFrame = 30,
  accent = COLORS.gold,
  zoom,
}) => {
  const frame = useCurrentFrame();
  const titleReveal = ease(frame, 0, 13);
  const exit = interpolate(frame, [48, 59], [1, 0], clamp);

  return (
    <Backdrop accent={accent}>
      <div
        style={{
          position: "absolute",
          left: 58,
          right: 58,
          top: 53,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: exit,
        }}
      >
        <MiniBrand />
        <div
          style={{
            border: "1px solid rgba(255,255,255,.15)",
            borderRadius: 999,
            padding: "10px 15px",
            color: "rgba(255,248,232,.66)",
            background: "rgba(0,0,0,.35)",
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: ".13em",
          }}
        >
          MOBILE CAPTURE
        </div>
      </div>

      <div style={{ position: "absolute", left: 58, right: 58, top: 145, opacity: titleReveal * exit }}>
        <div
          style={{
            color: accent,
            fontSize: 17,
            fontWeight: 950,
            letterSpacing: ".22em",
            marginBottom: 14,
          }}
        >
          {String(number).padStart(2, "0")} · {label}
        </div>
        <div
          style={{
            fontSize: 66,
            lineHeight: .96,
            fontWeight: 950,
            letterSpacing: "-.055em",
            transform: `translateY(${interpolate(titleReveal, [0, 1], [30, 0])}px)`,
          }}
        >
          {title}
        </div>
      </div>

      <PhoneCapture
        image={image}
        imageTwo={imageTwo}
        switchFrame={switchFrame}
        frame={frame}
        accent={accent}
        zoom={zoom}
      />

      <div
        style={{
          position: "absolute",
          left: 934,
          top: 420,
          bottom: 128,
          width: 5,
          borderRadius: 99,
          background: "rgba(255,255,255,.1)",
          overflow: "hidden",
          opacity: exit,
        }}
      >
        <div
          style={{
            width: "100%",
            height: `${Math.min(100, number * 11)}%`,
            borderRadius: 99,
            background: accent,
            boxShadow: `0 0 18px ${accent}`,
          }}
        />
      </div>
    </Backdrop>
  );
};

const VerdictScene = () => {
  const frame = useCurrentFrame();
  const flash = interpolate(frame, [0, 2, 5], [1, .18, 0], clamp);
  const reveal = ease(frame, 2, 15);

  return (
    <Backdrop accent={COLORS.red}>
      <div style={{ position: "absolute", left: 58, top: 58 }}>
        <MiniBrand />
      </div>
      <div style={{ position: "absolute", left: 58, right: 58, top: 150, opacity: reveal }}>
        <div style={{ color: COLORS.red, fontWeight: 950, fontSize: 18, letterSpacing: ".22em" }}>
          FINAL RULING
        </div>
        <div style={{ marginTop: 13, fontSize: 72, lineHeight: .95, fontWeight: 950, letterSpacing: "-.06em" }}>
          STILL LOST.
        </div>
      </div>
      <PhoneCapture
        image="33-ruling-detail.png"
        imageTwo="34-adverse-ruling.png"
        switchFrame={26}
        frame={frame}
        accent={COLORS.red}
        zoom={1.02}
      />
      <AbsoluteFill style={{ background: `rgba(255,255,255,${flash})`, pointerEvents: "none" }} />
    </Backdrop>
  );
};

const CTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 13, stiffness: 118, mass: .8 } });
  const title = ease(frame, 8, 24);
  const button = ease(frame, 24, 39);
  const pulse = 1 + Math.sin(frame / 5) * .012;

  return (
    <Backdrop accent={COLORS.green}>
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
          border: "1px solid rgba(241,206,108,.5)",
          background: "linear-gradient(145deg, rgba(255,255,255,.12), rgba(255,255,255,.025))",
          boxShadow: "0 30px 90px rgba(0,0,0,.55), 0 0 48px rgba(57,221,136,.13)",
        }}
      >
        <Img src={staticFile("logoAndName.png")} style={{ width: 105, height: 105 }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: 410,
          textAlign: "center",
          opacity: title,
          transform: `translateY(${interpolate(title, [0, 1], [45, 0])}px)`,
        }}
      >
        <div style={{ color: COLORS.gold, fontSize: 22, fontWeight: 950, letterSpacing: ".22em" }}>
          YOUR TURN, COUNSEL
        </div>
        <div
          style={{
            marginTop: 42,
            fontSize: 100,
            lineHeight: .93,
            fontWeight: 950,
            letterSpacing: "-.07em",
          }}
        >
          THINK YOU
          <br />
          CAN DO
          <br />
          <span style={{ color: COLORS.green }}>BETTER?</span>
        </div>
        <div
          style={{
            margin: "64px auto 0",
            width: 150,
            height: 7,
            borderRadius: 99,
            background: COLORS.gold,
            boxShadow: `0 0 26px ${COLORS.gold}`,
          }}
        />
        <div style={{ marginTop: 45, fontSize: 31, lineHeight: 1.35, color: "rgba(255,248,232,.74)" }}>
          Interview the client. Find the proof.
          <br />
          Make the argument.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 86,
          right: 86,
          bottom: 245,
          borderRadius: 25,
          padding: "28px 30px",
          background: COLORS.cream,
          color: COLORS.black,
          textAlign: "center",
          fontWeight: 950,
          fontSize: 31,
          letterSpacing: ".07em",
          boxShadow: "0 24px 70px rgba(0,0,0,.5), 0 0 45px rgba(241,206,108,.18)",
          opacity: button,
          transform: `translateY(${interpolate(button, [0, 1], [40, 0])}px) scale(${pulse})`,
        }}
      >
        PLAY YOUR FIRST CASE FREE
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 158,
          color: COLORS.gold,
          textAlign: "center",
          fontSize: 29,
          fontWeight: 950,
          letterSpacing: ".08em",
          opacity: button,
        }}
      >
        LEGALARENA.APP
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 80,
          textAlign: "center",
          color: "rgba(255,255,255,.44)",
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: ".16em",
          opacity: button,
        }}
      >
        AI-POWERED · NO SCRIPTED DIALOGUE
      </div>
    </Backdrop>
  );
};

const SCENES = [
  {
    from: 45,
    number: 1,
    label: "THE CASE",
    title: "$900 ON THE LINE.",
    image: "01-case-header.png",
    imageTwo: "03-opponent-argument.png",
    accent: COLORS.gold,
  },
  {
    from: 99,
    number: 2,
    label: "THE PRESSURE",
    title: "THE AI JUDGE SAW A WEAK CASE.",
    image: "17-court-resumed.png",
    accent: COLORS.red,
  },
  {
    from: 159,
    number: 3,
    label: "YOUR MOVE",
    title: "SO I MADE MY ARGUMENT.",
    image: "04-argument-typed.png",
    imageTwo: "05-argument-submitting.png",
    accent: COLORS.blue,
  },
  {
    from: 219,
    number: 4,
    label: "JUDGE’S ORDER",
    title: "THE COURT STOPPED ME.",
    image: "06-judge-orders-more-evidence.png",
    accent: COLORS.gold,
  },
  {
    from: 291,
    number: 5,
    label: "BACK TO INTAKE",
    title: "FIND THE MISSING EVIDENCE.",
    image: "07-intake-reopened.png",
    accent: COLORS.gold,
  },
  {
    from: 351,
    number: 6,
    label: "CLIENT INTERVIEW",
    title: "ASK ANYTHING.",
    image: "10-question-typed.png",
    imageTwo: "11-question-submitting.png",
    accent: COLORS.green,
  },
  {
    from: 411,
    number: 7,
    label: "THE ANSWER",
    title: "“NO PHOTOS.”",
    image: "12-client-answer.png",
    imageTwo: "15-photo-answer.png",
    switchFrame: 24,
    accent: COLORS.red,
  },
  {
    from: 471,
    number: 8,
    label: "ADAPT",
    title: "CHANGE STRATEGY. GO BACK IN.",
    image: "16-finalize-fact-sheet.png",
    imageTwo: "20-comeback-typed.png",
    switchFrame: 22,
    accent: COLORS.blue,
  },
  {
    from: 531,
    number: 9,
    label: "THE COMEBACK",
    title: "13% → 24%",
    image: "22-round-two-score.png",
    imageTwo: "26-round-three-score.png",
    accent: COLORS.green,
  },
];

export const LegalArenaInstagramPromoV2 = () => (
  <AbsoluteFill style={{ background: COLORS.black }}>
    <Audio src={staticFile("media/legal-arena-promo-v2-beat.wav")} volume={0.9} />
    <Sequence from={0} durationInFrames={45}>
      <Hook />
    </Sequence>
    {SCENES.map((scene, index) => {
      const nextFrom = SCENES[index + 1]?.from ?? 591;
      return (
        <Sequence key={scene.from} from={scene.from} durationInFrames={nextFrom - scene.from}>
          <StoryScene {...scene} />
        </Sequence>
      );
    })}
    <Sequence from={591} durationInFrames={57}>
      <VerdictScene />
    </Sequence>
    <Sequence from={648} durationInFrames={72}>
      <CTA />
    </Sequence>
  </AbsoluteFill>
);

export const instagramPromoV2Defaults = {
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 720,
};

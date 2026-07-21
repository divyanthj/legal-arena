import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const COLORS = {
  ink: "#050706",
  paper: "#f8f3e8",
  gold: "#e8c870",
  goldSoft: "#8f763c",
  green: "#44d17d",
  muted: "rgba(248, 243, 232, 0.66)",
};

const font = "Inter, Arial, sans-serif";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
};

const reveal = (frame, start, duration = 12) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

const Grain = () => (
  <AbsoluteFill
    style={{
      opacity: 0.075,
      mixBlendMode: "screen",
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E\")",
    }}
  />
);

const Background = ({ children }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 34) * 26;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        color: COLORS.paper,
        fontFamily: font,
        background:
          "linear-gradient(160deg, #07110d 0%, #050706 47%, #100d06 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          left: -390 + drift,
          top: 90,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(38, 154, 88, .32), transparent 68%)",
          filter: "blur(32px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 820,
          height: 820,
          right: -430 - drift,
          bottom: 20,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(232, 200, 112, .25), transparent 69%)",
          filter: "blur(38px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.12,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.11) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.11) 1px, transparent 1px)",
          backgroundSize: "84px 84px",
          maskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
        }}
      />
      {children}
      <Grain />
    </AbsoluteFill>
  );
};

const CornerMarks = () => (
  <>
    <div
      style={{
        position: "absolute",
        left: 48,
        top: 48,
        width: 54,
        height: 54,
        borderTop: `2px solid ${COLORS.gold}`,
        borderLeft: `2px solid ${COLORS.gold}`,
        opacity: 0.7,
      }}
    />
    <div
      style={{
        position: "absolute",
        right: 48,
        bottom: 48,
        width: 54,
        height: 54,
        borderRight: `2px solid ${COLORS.gold}`,
        borderBottom: `2px solid ${COLORS.gold}`,
        opacity: 0.7,
      }}
    />
  </>
);

const BrandLockup = ({ compact = false }) => (
  <div style={{ display: "flex", alignItems: "center", gap: compact ? 12 : 18 }}>
    <div
      style={{
        width: compact ? 46 : 66,
        height: compact ? 46 : 66,
        borderRadius: compact ? 12 : 17,
        border: "1px solid rgba(232, 200, 112, .42)",
        background: "rgba(255,255,255,.055)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <Img
        src={staticFile("logoAndName.png")}
        style={{ width: compact ? 34 : 48, height: compact ? 34 : 48, objectFit: "contain" }}
      />
    </div>
    <div>
      <div
        style={{
          fontWeight: 850,
          fontSize: compact ? 25 : 34,
          lineHeight: 1,
          letterSpacing: "-0.035em",
        }}
      >
        LEGAL ARENA
      </div>
      {!compact && (
        <div
          style={{
            color: COLORS.gold,
            marginTop: 7,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: ".2em",
          }}
        >
          AI LAWYER GAME
        </div>
      )}
    </div>
  </div>
);

const Intro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 125, mass: 0.8 } });
  const line1 = reveal(frame, 5, 14);
  const line2 = reveal(frame, 11, 14);
  const line3 = reveal(frame, 19, 12);
  const exit = interpolate(frame, [37, 45], [1, 0], clamp);

  return (
    <Background>
      <CornerMarks />
      <div style={{ position: "absolute", left: 76, top: 82, opacity: reveal(frame, 0, 10) }}>
        <BrandLockup compact />
      </div>
      <div
        style={{
          position: "absolute",
          inset: "350px 72px auto",
          opacity: exit,
          transform: `scale(${interpolate(pop, [0, 1], [0.92, 1])})`,
        }}
      >
        <div
          style={{
            color: COLORS.gold,
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: ".22em",
            marginBottom: 34,
            opacity: reveal(frame, 0, 10),
          }}
        >
          YOUR NEXT CASE STARTS NOW
        </div>
        <div
          style={{
            fontSize: 122,
            fontWeight: 950,
            lineHeight: 0.91,
            letterSpacing: "-.07em",
            transform: `translateY(${interpolate(line1, [0, 1], [44, 0])}px)`,
            opacity: line1,
          }}
        >
          THINK
        </div>
        <div
          style={{
            fontSize: 122,
            fontWeight: 950,
            lineHeight: 0.91,
            letterSpacing: "-.07em",
            color: COLORS.gold,
            transform: `translateY(${interpolate(line2, [0, 1], [44, 0])}px)`,
            opacity: line2,
          }}
        >
          LIKE A
        </div>
        <div
          style={{
            fontSize: 122,
            fontWeight: 950,
            lineHeight: 0.91,
            letterSpacing: "-.07em",
            transform: `translateY(${interpolate(line3, [0, 1], [44, 0])}px)`,
            opacity: line3,
          }}
        >
          LAWYER.
        </div>
        <div
          style={{
            marginTop: 62,
            width: 128,
            height: 7,
            borderRadius: 99,
            background: COLORS.green,
            boxShadow: `0 0 28px ${COLORS.green}`,
            transform: `scaleX(${reveal(frame, 22, 12)})`,
            transformOrigin: "left",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 74,
          bottom: 94,
          color: COLORS.muted,
          fontSize: 23,
          letterSpacing: ".08em",
          opacity: reveal(frame, 24, 10),
        }}
      >
        REAL GAMEPLAY · POWERED BY AI
      </div>
    </Background>
  );
};

const BEATS = [
  { from: 0, to: 52, eyebrow: "THE BRIEF", title: "OPEN THE CASE", accent: COLORS.gold, index: 0 },
  { from: 52, to: 139, eyebrow: "CLIENT INTAKE", title: "ASK THE RIGHT QUESTIONS", accent: "#6de0a0", index: 1 },
  { from: 139, to: 240, eyebrow: "CASE STRATEGY", title: "BUILD YOUR ARGUMENT", accent: "#84c6ff", index: 2 },
  { from: 240, to: 354, eyebrow: "THE COURTROOM", title: "FIGHT THE OTHER SIDE", accent: "#ffb767", index: 3 },
  { from: 354, to: 476, eyebrow: "THE VERDICT", title: "PROVE YOUR CASE", accent: COLORS.green, index: 4 },
];

const getBeat = (frame) => BEATS.find((beat) => frame >= beat.from && frame < beat.to) || BEATS.at(-1);

const Gameplay = () => {
  const frame = useCurrentFrame();
  const beat = getBeat(frame);
  const local = frame - beat.from;
  const titleIn = reveal(local, 0, 9);
  const cardIn = spring({ frame, fps: 30, config: { damping: 18, stiffness: 110 } });
  const exit = interpolate(frame, [465, 476], [1, 0], clamp);
  const pulse = 0.5 + Math.sin(frame / 8) * 0.5;

  return (
    <Background>
      <AbsoluteFill style={{ opacity: 0.2, transform: "scale(3.7)", filter: "blur(35px) saturate(1.35)" }}>
        <OffthreadVideo
          muted
          src={staticFile("media/gameplay-showcase.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(3, 6, 4, .54)" }} />
      <CornerMarks />

      <div style={{ position: "absolute", left: 62, right: 62, top: 62, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: exit }}>
        <BrandLockup compact />
        <div
          style={{
            display: "flex",
            gap: 9,
            alignItems: "center",
            border: "1px solid rgba(255,255,255,.16)",
            borderRadius: 999,
            padding: "11px 16px",
            background: "rgba(0,0,0,.34)",
            color: COLORS.muted,
            fontSize: 14,
            fontWeight: 850,
            letterSpacing: ".14em",
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: COLORS.green,
              boxShadow: `0 0 ${10 + pulse * 9}px ${COLORS.green}`,
            }}
          />
          LIVE CASE
        </div>
      </div>

      <div style={{ position: "absolute", left: 62, right: 62, top: 224, opacity: exit }}>
        <div
          key={`${beat.eyebrow}-eyebrow`}
          style={{
            color: beat.accent,
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: ".22em",
            marginBottom: 17,
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [22, 0])}px)`,
          }}
        >
          {beat.eyebrow}
        </div>
        <div
          key={beat.title}
          style={{
            maxWidth: 900,
            fontSize: 72,
            lineHeight: 0.96,
            fontWeight: 950,
            letterSpacing: "-.055em",
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [34, 0])}px)`,
          }}
        >
          {beat.title}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 62,
          right: 62,
          top: 520,
          height: 740,
          border: "1px solid rgba(232, 200, 112, .42)",
          borderRadius: 34,
          background: "#060807",
          overflow: "hidden",
          boxShadow: "0 38px 90px rgba(0,0,0,.52), 0 0 0 8px rgba(255,255,255,.025)",
          opacity: exit,
          transform: `translateY(${interpolate(cardIn, [0, 1], [60, 0])}px) scale(${interpolate(cardIn, [0, 1], [0.965, 1])})`,
        }}
      >
        <div
          style={{
            height: 54,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 22px",
            borderBottom: "1px solid rgba(255,255,255,.09)",
            background: "linear-gradient(180deg, #181b18, #0d100e)",
          }}
        >
          <div style={{ display: "flex", gap: 9 }}>
            {["#ff675f", "#f7c95f", "#45cc75"].map((color) => (
              <span key={color} style={{ width: 11, height: 11, borderRadius: "50%", background: color }} />
            ))}
          </div>
          <div style={{ color: "rgba(255,255,255,.44)", fontSize: 13, fontWeight: 800, letterSpacing: ".14em" }}>
            LEGALARENA.APP
          </div>
          <div style={{ width: 51 }} />
        </div>
        <OffthreadVideo
          muted
          src={staticFile("media/gameplay-showcase.mp4")}
          style={{ width: "100%", height: 686, objectFit: "cover", objectPosition: "center" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 54,
            pointerEvents: "none",
            boxShadow: "inset 0 0 90px rgba(0,0,0,.24)",
          }}
        />
      </div>

      <div style={{ position: "absolute", left: 62, right: 62, bottom: 166, opacity: exit }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: COLORS.muted,
            fontSize: 16,
            fontWeight: 850,
            letterSpacing: ".12em",
            marginBottom: 18,
          }}
        >
          {["BRIEF", "INTAKE", "STRATEGY", "COURT", "VERDICT"].map((label, index) => (
            <span key={label} style={{ color: index === beat.index ? beat.accent : COLORS.muted }}>
              {label}
            </span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 9 }}>
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              style={{
                height: 8,
                borderRadius: 99,
                background: index <= beat.index ? beat.accent : "rgba(255,255,255,.13)",
                boxShadow: index === beat.index ? `0 0 18px ${beat.accent}77` : "none",
              }}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 62,
          right: 62,
          bottom: 75,
          display: "flex",
          justifyContent: "space-between",
          color: "rgba(255,255,255,.46)",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: ".13em",
          opacity: exit,
        }}
      >
        <span>REAL IN-GAME CAPTURE</span>
        <span>01 / 01</span>
      </div>
    </Background>
  );
};

const Outro = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoPop = spring({ frame, fps, config: { damping: 12, stiffness: 115, mass: 0.8 } });
  const title = reveal(frame, 8, 15);
  const cta = reveal(frame, 22, 15);

  return (
    <Background>
      <CornerMarks />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 178,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 150,
            height: 150,
            display: "grid",
            placeItems: "center",
            borderRadius: 38,
            border: "1px solid rgba(232, 200, 112, .48)",
            background: "linear-gradient(145deg, rgba(255,255,255,.12), rgba(255,255,255,.025))",
            boxShadow: "0 25px 70px rgba(0,0,0,.45), 0 0 55px rgba(232, 200, 112, .13)",
            transform: `scale(${logoPop}) rotate(${interpolate(logoPop, [0, 1], [-5, 0])}deg)`,
          }}
        >
          <Img src={staticFile("logoAndName.png")} style={{ width: 112, height: 112 }} />
        </div>
        <div
          style={{
            marginTop: 52,
            color: COLORS.gold,
            fontSize: 24,
            fontWeight: 900,
            letterSpacing: ".24em",
            opacity: title,
          }}
        >
          LEGAL ARENA
        </div>
        <div
          style={{
            marginTop: 40,
            maxWidth: 900,
            fontSize: 91,
            lineHeight: 0.98,
            fontWeight: 950,
            letterSpacing: "-.06em",
            opacity: title,
            transform: `translateY(${interpolate(title, [0, 1], [38, 0])}px)`,
          }}
        >
          YOUR CASE.
          <br />
          YOUR ARGUMENT.
          <br />
          <span style={{ color: COLORS.green }}>YOUR VERDICT.</span>
        </div>
        <div
          style={{
            marginTop: 75,
            borderRadius: 22,
            padding: "26px 52px",
            color: COLORS.ink,
            background: COLORS.paper,
            fontSize: 31,
            fontWeight: 950,
            letterSpacing: ".08em",
            boxShadow: "0 18px 55px rgba(0,0,0,.4), 0 0 35px rgba(232, 200, 112, .22)",
            opacity: cta,
            transform: `translateY(${interpolate(cta, [0, 1], [30, 0])}px)`,
          }}
        >
          PLAY NOW
        </div>
        <div
          style={{
            marginTop: 28,
            color: COLORS.gold,
            fontSize: 28,
            fontWeight: 850,
            letterSpacing: ".08em",
            opacity: cta,
          }}
        >
          LEGALARENA.APP
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 77,
          textAlign: "center",
          color: "rgba(255,255,255,.48)",
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: ".18em",
          opacity: reveal(frame, 30, 12),
        }}
      >
        AI-POWERED · EVERY CASE PLAYS DIFFERENTLY
      </div>
    </Background>
  );
};

export const LegalArenaInstagramPromo = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("media/legal-arena-promo-beat.wav")} volume={0.82} />
    <Sequence from={0} durationInFrames={45}>
      <Intro />
    </Sequence>
    <Sequence from={45} durationInFrames={476}>
      <Gameplay />
    </Sequence>
    <Sequence from={521} durationInFrames={79}>
      <Outro />
    </Sequence>
  </AbsoluteFill>
);

export const instagramPromoDefaults = {
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 600,
};

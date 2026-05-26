import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const palette = {
  background: "#06141d",
  backgroundSoft: "#112632",
  panel: "rgba(10, 23, 33, 0.82)",
  panelStrong: "rgba(12, 25, 36, 0.94)",
  text: "#f7fafc",
  textMuted: "rgba(247, 250, 252, 0.72)",
  stroke: "rgba(255,255,255,0.12)",
};

const styles = {
  page: {
    backgroundColor: palette.background,
    color: palette.text,
    fontFamily: "Inter, system-ui, sans-serif",
  },
  gradientOrb: (top, left, color) => ({
    position: "absolute",
    top,
    left,
    width: 620,
    height: 620,
    borderRadius: "50%",
    background: `radial-gradient(circle, ${color} 0%, rgba(255,255,255,0) 72%)`,
    filter: "blur(24px)",
    opacity: 0.34,
  }),
  shell: {
    position: "absolute",
    inset: 58,
    border: `1px solid ${palette.stroke}`,
    borderRadius: 34,
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)",
    boxShadow: "0 32px 100px rgba(0, 0, 0, 0.35)",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1.05fr 0.95fr",
    height: "100%",
  },
  leftPanel: {
    padding: "72px 72px 64px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  rightPanel: {
    position: "relative",
    background: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))",
    borderLeft: `1px solid ${palette.stroke}`,
    overflow: "hidden",
  },
};

const AnimatedBackground = ({ frame }) => {
  const driftA = interpolate(frame, [0, 180], [0, 40], {
    extrapolateRight: "clamp",
  });
  const driftB = interpolate(frame, [0, 180], [0, -35], {
    extrapolateRight: "clamp",
  });

  return (
    <>
      <div style={styles.gradientOrb(-160 + driftA, -120, "rgba(88, 195, 255, 0.55)")} />
      <div style={styles.gradientOrb(500 + driftB, 1280, "rgba(255, 143, 61, 0.52)")} />
      <div style={styles.gradientOrb(120, 900 + driftA, "rgba(126, 240, 199, 0.35)")} />
    </>
  );
};

const IntroScene = ({ title, subtitle, logoSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({
    fps,
    frame,
    config: {
      damping: 14,
      stiffness: 120,
      mass: 0.9,
    },
  });
  const fade = interpolate(frame, [0, 16, 60], [0, 1, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ ...styles.page, padding: 72, opacity: fade }}>
      <AnimatedBackground frame={frame} />
      <div
        style={{
          flex: 1,
          borderRadius: 34,
          border: `1px solid ${palette.stroke}`,
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.085), rgba(255,255,255,0.018))",
          padding: "72px 80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          transform: `translateY(${interpolate(rise, [0, 1], [48, 0])}px)`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              border: `1px solid ${palette.stroke}`,
              borderRadius: 999,
              padding: "12px 18px",
              backgroundColor: "rgba(255,255,255,0.04)",
              fontSize: 20,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Live Playthrough
          </div>
          <Img src={staticFile(logoSrc)} style={{ width: 320, objectFit: "contain" }} />
        </div>
        <div style={{ maxWidth: 980 }}>
          <p style={{ color: palette.textMuted, fontSize: 24, letterSpacing: "0.24em" }}>
            LEGAL ARENA TUTORIAL
          </p>
          <h1 style={{ fontSize: 94, lineHeight: 1, margin: "18px 0 24px", fontWeight: 800 }}>
            {title}
          </h1>
          <p style={{ fontSize: 32, lineHeight: 1.35, color: palette.textMuted }}>
            {subtitle}
          </p>
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          {["Fresh dispute", "3 courtroom rounds", "Verdict captured"].map((item) => (
            <div
              key={item}
              style={{
                border: `1px solid ${palette.stroke}`,
                borderRadius: 18,
                padding: "18px 22px",
                backgroundColor: "rgba(255,255,255,0.03)",
                fontSize: 22,
                color: palette.textMuted,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ScreenshotCard = ({ step, screenshotShift, screenshotScale }) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 30,
        borderRadius: 28,
        overflow: "hidden",
        border: `1px solid ${palette.stroke}`,
        backgroundColor: palette.panelStrong,
        transform: `translateY(${screenshotShift}px) scale(${screenshotScale})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 22,
          right: 22,
          top: 18,
          display: "flex",
          alignItems: "center",
          gap: 10,
          zIndex: 2,
        }}
      >
        {["#ff6259", "#ffbe2f", "#29c940"].map((dot) => (
          <span
            key={dot}
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: dot,
              opacity: 0.92,
            }}
          />
        ))}
      </div>
      <Img
        src={staticFile(step.imageSrc)}
        alt={step.imageAlt}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "top center",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(6,20,29,0.02) 0%, rgba(6,20,29,0.18) 45%, rgba(6,20,29,0.62) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          bottom: 24,
          borderRadius: 20,
          backgroundColor: palette.panel,
          border: `1px solid ${palette.stroke}`,
          padding: "22px 24px",
        }}
      >
        <p
          style={{
            fontSize: 18,
            letterSpacing: "0.18em",
            color: step.accent,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          On-screen callout
        </p>
        <p
          style={{
            fontSize: 27,
            lineHeight: 1.35,
            margin: "10px 0 0",
            color: palette.text,
          }}
        >
          {step.body}
        </p>
      </div>
    </div>
  );
};

const StepScene = ({ step, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({
    fps,
    frame,
    config: {
      damping: 16,
      stiffness: 120,
    },
  });
  const panelShift = interpolate(entrance, [0, 1], [28, 0]);
  const screenshotShift = interpolate(entrance, [0, 1], [44, 0]);
  const screenshotScale = interpolate(frame, [0, 90], [1.02, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={styles.page}>
      <AnimatedBackground frame={frame + index * 12} />
      <div style={styles.shell}>
        <div style={styles.contentGrid}>
          <div style={{ ...styles.leftPanel, transform: `translateY(${panelShift}px)` }}>
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  borderRadius: 999,
                  border: `1px solid ${step.accent}55`,
                  backgroundColor: `${step.accent}16`,
                  color: step.accent,
                  padding: "12px 18px",
                  fontSize: 18,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                Step {index + 1}
              </div>
              <p
                style={{
                  margin: "30px 0 0",
                  color: step.accent,
                  fontSize: 24,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                {step.eyebrow}
              </p>
              <h2 style={{ fontSize: 74, lineHeight: 1.02, margin: "18px 0 24px", fontWeight: 750 }}>
                {step.title}
              </h2>
              <p style={{ fontSize: 31, lineHeight: 1.42, color: palette.textMuted, maxWidth: 700 }}>
                {step.body}
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gap: 14,
              }}
            >
              {step.metrics.map((metric) => (
                <div
                  key={metric}
                  style={{
                    border: `1px solid ${palette.stroke}`,
                    borderRadius: 20,
                    backgroundColor: "rgba(255,255,255,0.035)",
                    padding: "18px 20px",
                    fontSize: 24,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: step.accent,
                      boxShadow: `0 0 24px ${step.accent}`,
                    }}
                  />
                  {metric}
                </div>
              ))}
            </div>
          </div>
          <div style={styles.rightPanel}>
            <ScreenshotCard
              step={step}
              screenshotShift={screenshotShift}
              screenshotScale={screenshotScale}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const OutroScene = ({ logoSrc }) => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 18, 54], [0, 1, 1], {
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 54], [0.96, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        ...styles.page,
        alignItems: "center",
        justifyContent: "center",
        opacity: fade,
        transform: `scale(${scale})`,
      }}
    >
      <AnimatedBackground frame={frame + 60} />
      <div
        style={{
          width: 1140,
          borderRadius: 34,
          border: `1px solid ${palette.stroke}`,
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.018))",
          padding: "72px 78px",
          textAlign: "center",
        }}
      >
        <Img
          src={staticFile(logoSrc)}
          style={{ width: 360, objectFit: "contain", margin: "0 auto 28px" }}
        />
        <h2 style={{ fontSize: 68, lineHeight: 1.04, margin: 0 }}>
          A full live dispute run, captured end to end
        </h2>
        <p style={{ fontSize: 28, lineHeight: 1.45, color: palette.textMuted, margin: "24px 0 0" }}>
          Next we can tighten this into a narrated product demo, add chapter cards, and smooth over the verdict-state inconsistency the run exposed.
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const LegalArenaDashboardTutorial = ({
  title,
  subtitle,
  steps,
  introFrames,
  outroFrames,
  stepFrames,
  logoSrc,
}) => {
  return (
    <AbsoluteFill style={styles.page}>
      <Sequence from={0} durationInFrames={introFrames}>
        <IntroScene title={title} subtitle={subtitle} logoSrc={logoSrc} />
      </Sequence>
      {steps.map((step, index) => (
        <Sequence
          key={`${step.title}-${index}`}
          from={introFrames + index * stepFrames}
          durationInFrames={stepFrames}
        >
          <StepScene step={step} index={index} />
        </Sequence>
      ))}
      <Sequence
        from={introFrames + steps.length * stepFrames}
        durationInFrames={outroFrames}
      >
        <OutroScene logoSrc={logoSrc} />
      </Sequence>
    </AbsoluteFill>
  );
};

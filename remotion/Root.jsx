import React from "react";
import { Composition } from "remotion";
import { LegalArenaDashboardTutorial } from "./compositions/LegalArenaDashboardTutorial";
import { tutorialVideoDefaults } from "./compositions/tutorialData";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="LegalArenaDashboardTutorial"
        component={LegalArenaDashboardTutorial}
        durationInFrames={tutorialVideoDefaults.durationInFrames}
        fps={tutorialVideoDefaults.fps}
        width={tutorialVideoDefaults.width}
        height={tutorialVideoDefaults.height}
        defaultProps={tutorialVideoDefaults}
      />
    </>
  );
};

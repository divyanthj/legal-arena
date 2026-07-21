import React from "react";
import { Composition } from "remotion";
import { LegalArenaDashboardTutorial } from "./compositions/LegalArenaDashboardTutorial";
import { tutorialVideoDefaults } from "./compositions/tutorialData";
import {
  LegalArenaInstagramPromo,
  instagramPromoDefaults,
} from "./compositions/LegalArenaInstagramPromo";
import {
  LegalArenaInstagramPromoV2,
  instagramPromoV2Defaults,
} from "./compositions/LegalArenaInstagramPromoV2";
import {
  LegalArenaInstagramPromoV3,
  instagramPromoV3Defaults,
} from "./compositions/LegalArenaInstagramPromoV3";

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
      <Composition
        id="LegalArenaInstagramPromo"
        component={LegalArenaInstagramPromo}
        durationInFrames={instagramPromoDefaults.durationInFrames}
        fps={instagramPromoDefaults.fps}
        width={instagramPromoDefaults.width}
        height={instagramPromoDefaults.height}
      />
      <Composition
        id="LegalArenaInstagramPromoV2"
        component={LegalArenaInstagramPromoV2}
        durationInFrames={instagramPromoV2Defaults.durationInFrames}
        fps={instagramPromoV2Defaults.fps}
        width={instagramPromoV2Defaults.width}
        height={instagramPromoV2Defaults.height}
      />
      <Composition
        id="LegalArenaInstagramPromoV3"
        component={LegalArenaInstagramPromoV3}
        durationInFrames={instagramPromoV3Defaults.durationInFrames}
        fps={instagramPromoV3Defaults.fps}
        width={instagramPromoV3Defaults.width}
        height={instagramPromoV3Defaults.height}
      />
    </>
  );
};

import config from "@/config";

export const ANDROID_PACKAGE_ID = "app.legalarena";
export const ANDROID_RELEASE_CHANNEL = "beta";
export const ANDROID_SHELL_VERSION = "0.1.0-beta.1";

const clean = (value = "") => String(value || "").trim();

export const getAndroidRelease = () => {
  const apkUrl = clean(process.env.ANDROID_APK_URL);
  const sha256 = clean(process.env.ANDROID_APK_SHA256).toLowerCase();
  const sizeBytes = Number(process.env.ANDROID_APK_SIZE_BYTES || 0);
  const releasedAt = clean(process.env.ANDROID_APK_RELEASED_AT);

  return {
    packageId: ANDROID_PACKAGE_ID,
    channel: ANDROID_RELEASE_CHANNEL,
    version: ANDROID_SHELL_VERSION,
    apkUrl,
    sha256,
    sizeBytes: Number.isFinite(sizeBytes) && sizeBytes > 0 ? sizeBytes : 0,
    releasedAt,
    available: Boolean(
      apkUrl &&
        apkUrl.startsWith("https://") &&
        sha256 &&
        /^[a-f0-9]{64}$/.test(sha256) &&
        sizeBytes > 0 &&
        releasedAt
    ),
    minimumAndroid: "9",
    downloadPageUrl: `https://${config.domainName}/download/android`,
    changelog: [
      "Install Legal Arena as a full-screen Android app.",
      "Use Google or email sign-in with account-bound lifetime access.",
      "Play solo and PVP matters with microphone transcription support.",
      "Receive an in-app notice when a new Android shell is available.",
    ],
  };
};


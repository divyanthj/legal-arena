# Legal Arena independent Android release

Legal Arena is distributed as a Trusted Web Activity (TWA) APK from
`https://legalarena.app/download/android`. The web application remains canonical;
the Android package provides a verified full-screen launcher.

## Permanent identity

- Package ID: `app.legalarena`
- Signing alias: `legal-arena`
- Minimum OS: Android 9 / API 28
- Compile and target SDK: API 36
- Production key path expected by release tooling:
  `secrets/legal-arena-release.keystore`

The package ID and signing key are permanent. Losing the signing key means
installed users cannot update to a replacement APK. Store the keystore encrypted
in the operational secret store and keep a separately encrypted offline backup.
Never commit the keystore, passwords, exported private keys, or a debug APK.

## First release

1. Deploy the PWA changes and confirm these URLs are public over HTTPS:
   `/manifest.webmanifest`, `/sw.js`, `/offline`, and all `/pwa/*.png` icons.
2. Install Android Studio with JDK 17 and Android SDK 36, or configure equivalent
   command-line tools.
3. Create the permanent release key once:

   `keytool -genkeypair -v -keystore secrets/legal-arena-release.keystore -alias legal-arena -keyalg RSA -keysize 4096 -validity 10000`

4. Extract its SHA-256 certificate fingerprint:

   `keytool -list -v -keystore secrets/legal-arena-release.keystore -alias legal-arena`

5. Configure `ANDROID_SIGNING_SHA256` in the hosted environment and verify that
   `/.well-known/assetlinks.json` contains the production fingerprint.
6. Set `BUBBLEWRAP_KEYSTORE_PASSWORD` and `BUBBLEWRAP_KEY_PASSWORD` in the
   current release shell. Run `npm run android:build`.
7. Install the artifact on a clean Android device. Confirm there is no browser
   toolbar; a toolbar means Digital Asset Links verification failed.
8. Upload the signed APK to the HTTPS object path referenced by
   `ANDROID_APK_URL`. Copy the generated values from
   `artifacts/android/android-release.env` into the hosted environment.
9. Verify the public checksum matches the local artifact before enabling the
   download page.

## Updating

Increment `appVersionName`, `appVersionCode`, the `shell_version` query value in
`android-twa/twa-manifest.json`, and `ANDROID_SHELL_VERSION` in
`libs/appRelease.js`. Build with the same keystore and alias. Android requires
users to approve the downloaded update; the web application prompts installed
shells when the configured release is newer.

Most UI and gameplay releases do not require an APK update. Rebuild the shell
when changing the package configuration, icons, permissions, target SDK, TWA
dependency, or launcher behavior.

## Release checks

- Test install, update over the previous signed APK, uninstall/reinstall, OAuth,
  email magic links, microphone permission denial, transcription, file download,
  Lemon Squeezy checkout/return, restore access, rotation, split screen, and
  offline recovery.
- Test Android 9, 12, 14, 15, and 16, including a phone and tablet.
- Upload the exact release APK to Play Protect for scanning before publication.
- Register the package and signing identity in Android Developer Console before
  global verification enforcement reaches the launch market.


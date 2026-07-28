param(
  [string]$ManifestDirectory = "android-twa",
  [string]$OutputDirectory = "artifacts/android"
)

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestRoot = (Resolve-Path (Join-Path $workspaceRoot $ManifestDirectory)).Path
$manifestPath = Join-Path $manifestRoot "twa-manifest.json"
$signingKeyPath = Join-Path $workspaceRoot "secrets/legal-arena-release.keystore"
$artifactRoot = Join-Path $workspaceRoot $OutputDirectory

if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "Missing TWA manifest: $manifestPath"
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw "Java is required. Install Android Studio or JDK 17 and place java on PATH."
}

if (-not (Get-Command cmd.exe -ErrorAction SilentlyContinue)) {
  throw "cmd.exe is required to invoke npx on Windows."
}

if (-not (Test-Path -LiteralPath $signingKeyPath)) {
  throw "Missing permanent signing key: $signingKeyPath. Do not generate a disposable release key."
}

if (-not $env:BUBBLEWRAP_KEYSTORE_PASSWORD -or -not $env:BUBBLEWRAP_KEY_PASSWORD) {
  throw "Set BUBBLEWRAP_KEYSTORE_PASSWORD and BUBBLEWRAP_KEY_PASSWORD in the current shell."
}

Push-Location $manifestRoot
try {
  cmd.exe /c npx --yes @bubblewrap/cli@1.24.1 update --skipVersionUpgrade --manifest=.
  if ($LASTEXITCODE -ne 0) {
    throw "Bubblewrap project generation failed."
  }

  $gradleCandidates = @(
    (Join-Path $manifestRoot "app/build.gradle"),
    (Join-Path $manifestRoot "app/build.gradle.kts")
  )
  $gradlePath = $gradleCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

  if (-not $gradlePath) {
    throw "Bubblewrap did not generate an app Gradle file."
  }

  $gradleContent = Get-Content -Raw -LiteralPath $gradlePath
  $gradleContent = $gradleContent -replace "compileSdk(?:Version)?\s*[= ]\s*\d+", "compileSdkVersion 36"
  $gradleContent = $gradleContent -replace "targetSdk(?:Version)?\s*[= ]\s*\d+", "targetSdkVersion 36"
  Set-Content -LiteralPath $gradlePath -Value $gradleContent -Encoding utf8

  cmd.exe /c npx --yes @bubblewrap/cli@1.24.1 build --manifest=. --signingKeyPath="$signingKeyPath" --signingKeyAlias=legal-arena
  if ($LASTEXITCODE -ne 0) {
    throw "Bubblewrap release build failed."
  }
} finally {
  Pop-Location
}

$apkCandidates = @(
  (Join-Path $manifestRoot "app-release-signed.apk"),
  (Join-Path $manifestRoot "app/build/outputs/apk/release/app-release.apk")
)
$apkPath = $apkCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $apkPath) {
  throw "No signed APK was produced."
}

New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
$releaseName = "legal-arena-android-0.1.0-beta.1.apk"
$releasePath = Join-Path $artifactRoot $releaseName
Copy-Item -LiteralPath $apkPath -Destination $releasePath -Force

$hash = (Get-FileHash -LiteralPath $releasePath -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $releasePath).Length
$releasedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$metadataPath = Join-Path $artifactRoot "android-release.env"
$metadata = @(
  "ANDROID_APK_URL=https://legalarena.app/downloads/$releaseName",
  "ANDROID_APK_SHA256=$hash",
  "ANDROID_APK_SIZE_BYTES=$size",
  "ANDROID_APK_RELEASED_AT=$releasedAt"
)
Set-Content -LiteralPath $metadataPath -Value $metadata -Encoding utf8

Write-Host "Signed APK: $releasePath"
Write-Host "SHA-256: $hash"
Write-Host "Deployment metadata: $metadataPath"


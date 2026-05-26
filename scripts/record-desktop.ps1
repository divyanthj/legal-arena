param(
  [Parameter(Mandatory = $true)]
  [string]$FfmpegPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [Parameter(Mandatory = $true)]
  [string]$StopSignalPath,

  [Parameter(Mandatory = $true)]
  [string]$StatusPath,

  [int]$Framerate = 10
)

$outputDir = Split-Path -Parent $OutputPath
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

if (Test-Path $StopSignalPath) {
  Remove-Item -LiteralPath $StopSignalPath -Force
}

$statusDir = Split-Path -Parent $StatusPath
if (-not (Test-Path $statusDir)) {
  New-Item -ItemType Directory -Path $statusDir -Force | Out-Null
}

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $FfmpegPath
$psi.Arguments = "-y -f gdigrab -framerate $Framerate -i desktop -c:v libx264 -preset ultrafast -pix_fmt yuv420p `"$OutputPath`""
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardInput = $true

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $psi

$null = $process.Start()

$status = [ordered]@{
  wrapperPid = $PID
  ffmpegPid = $process.Id
  outputPath = $OutputPath
  startedAt = (Get-Date).ToString("o")
  framerate = $Framerate
}
$status | ConvertTo-Json | Set-Content -LiteralPath $StatusPath

while (-not $process.HasExited) {
  if (Test-Path $StopSignalPath) {
    $process.StandardInput.WriteLine("q")
    $process.StandardInput.Flush()
    break
  }

  Start-Sleep -Milliseconds 500
}

if (-not $process.HasExited) {
  $process.WaitForExit()
}

$status.finishedAt = (Get-Date).ToString("o")
$status.exitCode = $process.ExitCode
$status | ConvertTo-Json | Set-Content -LiteralPath $StatusPath

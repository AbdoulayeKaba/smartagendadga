$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root 'public\flags'
$sourceFile = Join-Path $root 'lib\workspace\mission-countries.ts'
$cdnBase = 'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.2.3/flags/4x3'

New-Item -ItemType Directory -Force -Path $dest | Out-Null

$content = Get-Content $sourceFile -Raw
$codes = [regex]::Matches($content, "'([A-Z]{2})'") |
  ForEach-Object { $_.Groups[1].Value.ToLower() } |
  Select-Object -Unique

$downloaded = 0
$skipped = 0
$failed = 0

foreach ($code in $codes) {
  $out = Join-Path $dest "$code.svg"
  if (Test-Path $out) {
    $skipped++
    continue
  }
  try {
    Invoke-WebRequest -Uri "$cdnBase/$code.svg" -OutFile $out -UseBasicParsing -TimeoutSec 15 | Out-Null
    $downloaded++
  } catch {
    $failed++
    Write-Host "Échec: $code"
  }
}

Write-Host "Drapeaux: $downloaded téléchargés, $skipped déjà présents, $failed échecs."

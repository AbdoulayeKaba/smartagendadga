Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$srcPath = Join-Path $root "scripts\arpt-logo-source.jpeg"
$src = [System.Drawing.Image]::FromFile($srcPath)

# Partie gauche du logo (symbole A + globe) — carré lisible en petit format
$cropSize = [Math]::Min($src.Width, $src.Height)
$cropRect = New-Object System.Drawing.Rectangle 0, 0, $cropSize, $cropSize

$cropped = New-Object System.Drawing.Bitmap $cropSize, $cropSize
$gCrop = [System.Drawing.Graphics]::FromImage($cropped)
$gCrop.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gCrop.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$gCrop.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gCrop.DrawImage($src, 0, 0, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
$gCrop.Dispose()
$src.Dispose()

function Save-PngIcon([int]$size, [string]$outPath) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.Clear([System.Drawing.Color]::White)
  $g.DrawImage($cropped, 0, 0, $size, $size)
  $g.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$outputs = @(
  @{ Size = 32; Path = "public\icon-light-32x32.png" },
  @{ Size = 32; Path = "public\icon-dark-32x32.png" },
  @{ Size = 32; Path = "public\favicon-32x32.png" },
  @{ Size = 180; Path = "public\apple-icon.png" },
  @{ Size = 192; Path = "public\icon-192.png" },
  @{ Size = 512; Path = "public\icon-512.png" },
  @{ Size = 180; Path = "app\icon.png" },
  @{ Size = 180; Path = "app\apple-icon.png" }
)

foreach ($item in $outputs) {
  $out = Join-Path $root $item.Path
  $dir = Split-Path $out -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Save-PngIcon -size $item.Size -outPath $out
  Write-Host "Generated $($item.Path) ($($item.Size)px)"
}

# favicon.ico (32x32 PNG encapsulé — compatible navigateurs modernes + Next.js)
$favicon32 = Join-Path $root "public\favicon-32x32.png"
Copy-Item $favicon32 (Join-Path $root "app\favicon.ico") -Force
Copy-Item $favicon32 (Join-Path $root "public\favicon.ico") -Force

$cropped.Dispose()
Write-Host "Done."

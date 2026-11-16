$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$manifestPath = Join-Path $workspaceRoot 'docs/plans/greensteps-tour-photo-enrichment/photo-manifest.json'
$manifest = Get-Content -Raw -Encoding utf8 $manifestPath | ConvertFrom-Json
$publicRoot = Join-Path $workspaceRoot 'my-app/public'
$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1

function Save-JpegVariant($sourceImage, [string]$targetPath, [int]$targetWidth) {
  $actualWidth = [Math]::Min($targetWidth, $sourceImage.Width)
  $actualHeight = [Math]::Max(1, [int][Math]::Round($sourceImage.Height * ($actualWidth / $sourceImage.Width)))
  $bitmap = [System.Drawing.Bitmap]::new($actualWidth, $actualHeight)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.DrawImage($sourceImage, 0, 0, $actualWidth, $actualHeight)
  $quality = [System.Drawing.Imaging.EncoderParameters]::new(1)
  $quality.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]84)
  $bitmap.Save($targetPath, $encoder, $quality)
  $graphics.Dispose(); $bitmap.Dispose(); $quality.Dispose()
  return @{ width = $actualWidth; height = $actualHeight }
}

foreach ($photo in $manifest) {
  $relativePath = [string]$photo.assetPath
  if (-not $relativePath.StartsWith('image/greensteps/tours/')) { throw "Unexpected photo path: $relativePath" }
  $sourcePath = Join-Path $publicRoot $relativePath
  $resolvedSource = (Resolve-Path -LiteralPath $sourcePath).Path
  if (-not $resolvedSource.StartsWith((Join-Path $publicRoot 'image/greensteps/tours'), [StringComparison]::OrdinalIgnoreCase)) { throw "Photo path escaped the asset directory: $relativePath" }
  $sourceImage = [System.Drawing.Image]::FromFile($resolvedSource)
  $baseTemp = "$resolvedSource.optimized.jpg"
  try {
    $baseDimensions = Save-JpegVariant $sourceImage $baseTemp 1600
    $variantRows = @()
    $sourceBase = [System.IO.Path]::Combine([System.IO.Path]::GetDirectoryName($resolvedSource), [System.IO.Path]::GetFileNameWithoutExtension($resolvedSource))
    foreach ($width in @(480, 960)) {
      $variantPath = "$sourceBase-$($width)w.jpg"
      $dimensions = Save-JpegVariant $sourceImage $variantPath $width
      $variantRelative = $variantPath.Substring($publicRoot.Length + 1).Replace('\', '/')
      $variantRows += @{ path = $variantRelative; width = $dimensions.width; height = $dimensions.height }
    }
    $variantRows += @{ path = $relativePath; width = $baseDimensions.width; height = $baseDimensions.height }
    $photo | Add-Member -NotePropertyName responsiveVariants -NotePropertyValue $variantRows -Force
    $photo | Add-Member -NotePropertyName width -NotePropertyValue $baseDimensions.width -Force
    $photo | Add-Member -NotePropertyName height -NotePropertyValue $baseDimensions.height -Force
    $photo.modifications = 'Proportional JPEG derivatives at up to 1600, 960, and 480 px widths; no crop.'
  } finally { $sourceImage.Dispose() }
  Move-Item -LiteralPath $baseTemp -Destination $resolvedSource -Force
}

$json = ConvertTo-Json -InputObject @($manifest) -Depth 12
[System.IO.File]::WriteAllText($manifestPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
Write-Output "Optimized $($manifest.Count) approved photographs with responsive JPEG variants."

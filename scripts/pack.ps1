# scripts/pack.ps1
# Genera dist/inspecciona-X.Y.Z.zip per carregar a chrome://extensions
# Ús: .\scripts\pack.ps1

$root         = Split-Path $PSScriptRoot -Parent
$manifestPath = Join-Path $root "manifest.json"
$version      = (Get-Content $manifestPath | ConvertFrom-Json).version

$distDir = Join-Path $root "dist"
if (-not (Test-Path $distDir)) { New-Item -ItemType Directory $distDir | Out-Null }

$zipPath = Join-Path $distDir "inspecciona-$version.zip"

# Directori temporal per muntar el zip
$tempDir = Join-Path $env:TEMP "inspecciona-pack-$([System.IO.Path]::GetRandomFileName())"
New-Item -ItemType Directory $tempDir | Out-Null

try {
    Copy-Item (Join-Path $root "manifest.json") $tempDir
    Copy-Item (Join-Path $root "src")    (Join-Path $tempDir "src")    -Recurse
    Copy-Item (Join-Path $root "assets") (Join-Path $tempDir "assets") -Recurse

    if (Test-Path $zipPath) { Remove-Item $zipPath }
    Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $zipPath

    Write-Host "Creat: $zipPath  (v$version)" -ForegroundColor Green
} finally {
    Remove-Item $tempDir -Recurse -Force
}

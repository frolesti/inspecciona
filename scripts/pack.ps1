# scripts/pack.ps1
# Genera zips multi-browser a dist/
# Per defecte: chrome, edge, brave, opera, ecosia, firefox i safari
# Ús:
#   .\scripts\pack.ps1
#   .\scripts\pack.ps1 -Browser firefox

param(
    [ValidateSet("all", "chrome", "edge", "brave", "opera", "ecosia", "firefox", "safari")]
    [string]$Browser = "all"
)

$root         = Split-Path $PSScriptRoot -Parent
$manifestPath = Join-Path $root "manifest.json"
$baseManifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version      = $baseManifest.version

$distDir = Join-Path $root "dist"
if (-not (Test-Path $distDir)) { New-Item -ItemType Directory $distDir | Out-Null }

$allBrowsers = @("chrome", "edge", "brave", "opera", "ecosia", "firefox", "safari")
$targetBrowsers = if ($Browser -eq "all") { $allBrowsers } else { @($Browser) }

function Get-ManifestForBrowser {
    param(
        [pscustomobject]$Base,
        [string]$BrowserName
    )

    # Clon profund per no mutar el manifest base entre iteracions
    $manifest = ($Base | ConvertTo-Json -Depth 100 | ConvertFrom-Json)

    if ($BrowserName -eq "firefox") {
        if (-not $manifest.PSObject.Properties["browser_specific_settings"]) {
            $manifest | Add-Member -MemberType NoteProperty -Name "browser_specific_settings" -Value ([pscustomobject]@{})
        }
        if (-not $manifest.browser_specific_settings.PSObject.Properties["gecko"]) {
            $manifest.browser_specific_settings | Add-Member -MemberType NoteProperty -Name "gecko" -Value ([pscustomobject]@{})
        }
        $manifest.browser_specific_settings.gecko | Add-Member -MemberType NoteProperty -Name "id" -Value "inspecciona@frolesti.cat" -Force
        $manifest.browser_specific_settings.gecko | Add-Member -MemberType NoteProperty -Name "strict_min_version" -Value "109.0" -Force
    }

    return $manifest
}

function Write-ManifestJson {
    param(
        [pscustomobject]$ManifestObject,
        [string]$Path
    )

    $json = $ManifestObject | ConvertTo-Json -Depth 100
    [System.IO.File]::WriteAllText($Path, $json, [System.Text.Encoding]::UTF8)
}

foreach ($browserName in $targetBrowsers) {
    $zipPath = Join-Path $distDir "inspecciona-$version-$browserName.zip"

    # Directori temporal per muntar cada zip amb el seu manifest
    $tempDir = Join-Path $env:TEMP "inspecciona-pack-$browserName-$([System.IO.Path]::GetRandomFileName())"
    New-Item -ItemType Directory $tempDir | Out-Null

    try {
        $browserManifest = Get-ManifestForBrowser -Base $baseManifest -BrowserName $browserName
        Write-ManifestJson -ManifestObject $browserManifest -Path (Join-Path $tempDir "manifest.json")

        Copy-Item (Join-Path $root "src")    (Join-Path $tempDir "src")    -Recurse
        Copy-Item (Join-Path $root "assets") (Join-Path $tempDir "assets") -Recurse

        if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
        Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $zipPath

        # Compatibilitat: mantenim també el nom històric per Chrome
        if ($browserName -eq "chrome") {
            $legacyZipPath = Join-Path $distDir "inspecciona-$version.zip"
            if (Test-Path $legacyZipPath) { Remove-Item $legacyZipPath -Force }
            Copy-Item $zipPath $legacyZipPath
            Write-Host "Creat: $zipPath i $legacyZipPath" -ForegroundColor Green
        } else {
            Write-Host "Creat: $zipPath" -ForegroundColor Green
        }
    } finally {
        Remove-Item $tempDir -Recurse -Force
    }
}

Write-Host "`nBuild completat per: $($targetBrowsers -join ', ')" -ForegroundColor Cyan

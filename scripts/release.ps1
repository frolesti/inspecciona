# scripts/release.ps1
# Puja la versió, crea el commit i el tag, i fa push a origin/main
# Ús: .\scripts\release.ps1 [major|minor|patch]   (per defecte: patch)

param(
    [ValidateSet("major", "minor", "patch")]
    [string]$bump = "patch"
)

$root         = Split-Path $PSScriptRoot -Parent
$manifestPath = Join-Path $root "manifest.json"

Set-Location $root
$dirty = git status --short
if ($dirty) {
    Write-Error "L'arbre de treball no esta net. Desa o commiteja els canvis abans de fer release."
    exit 1
}

# Llegir versió actual
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$parts    = $manifest.version -split '\.'

if ($parts.Count -ne 3) {
    Write-Error "Format de versió no reconegut: $($manifest.version)"
    exit 1
}

$major = [int]$parts[0]
$minor = [int]$parts[1]
$patch = [int]$parts[2]

switch ($bump) {
    "major" { $major++; $minor = 0; $patch = 0 }
    "minor" { $minor++; $patch = 0 }
    "patch" { $patch++ }
}

$newVersion      = "$major.$minor.$patch"
$manifest.version = $newVersion

# Escriure manifest.json actualitzat
$manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding UTF8

Write-Host "Versio: $($parts -join '.') -> $newVersion" -ForegroundColor Cyan

# Git
git add manifest.json
git commit -m "chore: bump version to $newVersion"
git tag "v$newVersion"
git push
git push --tags

Write-Host "v$newVersion publicada a GitHub" -ForegroundColor Green

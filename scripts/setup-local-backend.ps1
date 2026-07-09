param(
  [string]$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$backendRoot = Join-Path $WorkspaceRoot "backend"
$languageToolPath = Join-Path $backendRoot "languagetool"
$sinonimsPath = Join-Path $backendRoot "sinonims-cat"

New-Item -ItemType Directory -Force -Path $backendRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $WorkspaceRoot "local-backend\data") | Out-Null

function Ensure-Repo {
  param(
    [string]$Path,
    [string]$Url
  )

  if (Test-Path (Join-Path $Path ".git")) {
    git -C $Path pull
    return
  }

  if (-not (Test-Path $Path)) {
    git clone --depth 1 --single-branch --filter=blob:none $Url $Path
    return
  }

  Remove-Item -Recurse -Force $Path
  git clone --depth 1 --single-branch --filter=blob:none $Url $Path
}

Ensure-Repo -Path $languageToolPath -Url "https://github.com/languagetool-org/languagetool.git"
Ensure-Repo -Path $sinonimsPath -Url "https://github.com/Softcatala/sinonims-cat.git"

Write-Host "Repos clonats o actualitzats a:"
Write-Host "- $languageToolPath"
Write-Host "- $sinonimsPath"
Write-Host ""
Write-Host "Ara pots executar:"
Write-Host "docker compose -f compose.local.yml up --build"
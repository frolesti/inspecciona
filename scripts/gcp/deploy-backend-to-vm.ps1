param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,
  [Parameter(Mandatory = $false)]
  [string]$Zone = "us-west1-a",
  [Parameter(Mandatory = $false)]
  [string]$VmName = "inspecciona-api",
  [Parameter(Mandatory = $false)]
  [string]$RepoPath = "."
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "Missing command 'gcloud'. Install Google Cloud SDK first."
}

function Invoke-Gcloud {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  $output = Invoke-Expression $Command 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($output | Out-String)
  }
  return $output
}

$repoFullPath = (Resolve-Path $RepoPath).Path
$activeAccount = (Invoke-Gcloud -Command "gcloud config get-value account").Trim()
$remoteUser = ($activeAccount -split '@')[0]
if (-not $remoteUser) {
  throw "Could not determine remote SSH user from gcloud account."
}
$remotePath = "/home/$remoteUser/inspecciona"

Invoke-Gcloud -Command "gcloud compute ssh $VmName --zone $Zone --project $ProjectId --command \"mkdir -p $remotePath\"" | Out-Null

Write-Host "Uploading repository to VM..."
Invoke-Gcloud -Command "gcloud compute scp --recurse \"$repoFullPath\" \"${VmName}:$remotePath\" --zone $Zone --project $ProjectId" | Out-Null

Write-Host "Bootstrapping VM and starting backend..."
Invoke-Gcloud -Command "gcloud compute ssh $VmName --zone $Zone --project $ProjectId --command \"cd $remotePath; sudo bash scripts/bootstrap-vm-ubuntu.sh; bash scripts/start-vm-backend.sh\"" | Out-Null

Write-Host "Deployment command finished."
Write-Host "Check status with:"
Write-Host "gcloud compute ssh $VmName --zone $Zone --project $ProjectId --command 'cd $remotePath; docker compose --env-file .env.vm -f compose.vm.yml ps'"

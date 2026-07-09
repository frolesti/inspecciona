param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,
  [Parameter(Mandatory = $false)]
  [string]$ProjectName = "Inspecciona API",
  [Parameter(Mandatory = $false)]
  [string]$BillingAccount = "",
  [Parameter(Mandatory = $false)]
  [string]$Region = "us-west1",
  [Parameter(Mandatory = $false)]
  [string]$Zone = "us-west1-a",
  [Parameter(Mandatory = $false)]
  [string]$VmName = "inspecciona-api",
  [Parameter(Mandatory = $false)]
  [int]$DiskGb = 30
)

$ErrorActionPreference = "Stop"

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing command '$Name'. Install Google Cloud SDK first."
  }
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

Require-Command -Name "gcloud"

Write-Host "[1/7] Authenticating gcloud..."
$activeAccount = (Invoke-Gcloud -Command "gcloud auth list --filter=status:ACTIVE --format='value(account)'").Trim()
if (-not $activeAccount) {
  Invoke-Gcloud -Command "gcloud auth login --brief" | Out-Null
}

Write-Host "[2/7] Ensuring project exists..."
$existingProject = (& gcloud projects describe $ProjectId --format="value(projectId)" 2>$null)
if ($LASTEXITCODE -eq 0 -and $existingProject) {
  $projectExists = $true
} else {
  $projectExists = $false
}

if (-not $projectExists) {
  Invoke-Gcloud -Command "gcloud projects create $ProjectId --name=\"$ProjectName\"" | Out-Null
}

Invoke-Gcloud -Command "gcloud config set project $ProjectId" | Out-Null

if ($BillingAccount) {
  Write-Host "[3/7] Linking billing account..."
  Invoke-Gcloud -Command "gcloud billing projects link $ProjectId --billing-account $BillingAccount" | Out-Null
} else {
  Write-Host "[3/7] Billing account not provided. Skipping automatic link."
}

Write-Host "[4/7] Enabling required services..."
Invoke-Gcloud -Command "gcloud services enable compute.googleapis.com serviceusage.googleapis.com cloudbilling.googleapis.com --project $ProjectId" | Out-Null

Write-Host "[5/7] Creating firewall rule (HTTP/HTTPS)..."
$ruleName = "allow-inspecciona-http-https"
$existingRule = (& gcloud compute firewall-rules describe $ruleName --project $ProjectId --format="value(name)" 2>$null)
if ($LASTEXITCODE -eq 0 -and $existingRule) {
  $ruleExists = $true
} else {
  $ruleExists = $false
}

if (-not $ruleExists) {
  Invoke-Gcloud -Command "gcloud compute firewall-rules create $ruleName --project $ProjectId --allow \"tcp:80,tcp:443\" --target-tags inspecciona-api --description \"Allow HTTP and HTTPS for Inspecciona API\"" | Out-Null
}

Write-Host "[6/7] Creating e2-micro VM (Always Free profile)..."
$existingInstance = (& gcloud compute instances describe $VmName --project $ProjectId --zone $Zone --format="value(name)" 2>$null)
if ($LASTEXITCODE -eq 0 -and $existingInstance) {
  $instanceExists = $true
} else {
  $instanceExists = $false
}

if (-not $instanceExists) {
  Invoke-Gcloud -Command "gcloud compute instances create $VmName --project $ProjectId --zone $Zone --machine-type e2-micro --tags inspecciona-api --image-family ubuntu-2204-lts --image-project ubuntu-os-cloud --boot-disk-type pd-standard --boot-disk-size ${DiskGb}GB --scopes cloud-platform" | Out-Null
}

Write-Host "[7/7] Reading external IP..."
$ip = (Invoke-Gcloud -Command "gcloud compute instances describe $VmName --project $ProjectId --zone $Zone --format='value(networkInterfaces[0].accessConfigs[0].natIP)'").Trim()

Write-Host ""
Write-Host "Done. VM ready."
Write-Host "Project: $ProjectId"
Write-Host "VM:      $VmName"
Write-Host "Zone:    $Zone"
Write-Host "IP:      $ip"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1) Set DNS A records for your API domains to $ip"
Write-Host "2) gcloud compute ssh $VmName --zone $Zone --project $ProjectId"
Write-Host "3) On VM: clone repo, run scripts/bootstrap-vm-ubuntu.sh and scripts/start-vm-backend.sh"

param(
  [Parameter(Mandatory = $true)]
  [string]$BillingAccount,
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,
  [Parameter(Mandatory = $false)]
  [double]$BudgetAmountUsd = 1.0
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

Invoke-Gcloud -Command "gcloud config set project $ProjectId" | Out-Null

# This creates alerts only. Budgets do not hard-stop resources automatically.
Invoke-Gcloud -Command "gcloud beta billing budgets create --billing-account=$BillingAccount --display-name=\"inspecciona-cost-guardrail\" --budget-amount=$BudgetAmountUsd --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0 --filter-projects=\"projects/$ProjectId\"" | Out-Null

Write-Host "Budget alert created for project '$ProjectId' at $BudgetAmountUsd USD."
Write-Host "Important: budget alerts do not stop billing automatically."

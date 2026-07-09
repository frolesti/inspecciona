param(
  [int]$TimeoutSeconds = 300,
  [int]$PollSeconds = 5
)

$ErrorActionPreference = "Stop"

function Test-Corrector {
  try {
    $body = "text=prova&language=ca-ES"
    $null = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8081/v2/check" -ContentType "application/x-www-form-urlencoded" -Body $body -TimeoutSec 10
    return $true
  } catch {
    return $false
  }
}

function Test-Sinonims {
  try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:8000/sinonims-api/search/feli%C3%A7" -TimeoutSec 10
    return $true
  } catch {
    return $false
  }
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)

Write-Host "Comprovant backend local..."
while ((Get-Date) -lt $deadline) {
  $okCorrector = Test-Corrector
  $okSinonims = Test-Sinonims

  if ($okCorrector -and $okSinonims) {
    Write-Host "OK: backend local llest (corrector + sinonims)"
    exit 0
  }

  $status = @()
  $status += if ($okCorrector) { "corrector=ok" } else { "corrector=esperant" }
  $status += if ($okSinonims) { "sinonims=ok" } else { "sinonims=esperant" }
  Write-Host ("Pendent: " + ($status -join ", "))

  Start-Sleep -Seconds $PollSeconds
}

Write-Error "Timeout: el backend local encara no esta llest. Mira logs amb: docker logs --tail 80 inspecciona-languagetool-1"
exit 1

param(
	[Parameter(Mandatory = $true)]
	[string]$ProjectId,
	[Parameter(Mandatory = $true)]
	[string]$Zone,
	[Parameter(Mandatory = $true)]
	[string]$InstanceName,
	[Parameter(Mandatory = $true)]
	[string]$AlertEmail,
	[Parameter(Mandatory = $false)]
	[double]$CpuThreshold = 0.80,
	[Parameter(Mandatory = $false)]
	[int]$DurationSeconds = 300
)

$ErrorActionPreference = "Stop"
$env:CLOUDSDK_PAGER = ""

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

$instanceId = (Invoke-Gcloud -Command "gcloud compute instances describe $InstanceName --zone $Zone --format=`"value(id)`"").Trim()
if (-not $instanceId) {
	throw "Could not resolve instance id for $InstanceName in zone $Zone"
}

$existingChannel = $null
$channelsJson = Invoke-Gcloud -Command "gcloud beta monitoring channels list --format=json"
$channels = @()
if ($channelsJson) {
	$channels = $channelsJson | ConvertFrom-Json
}

foreach ($ch in $channels) {
	if ($ch.type -eq "email" -and $ch.labels.email_address -eq $AlertEmail) {
		$existingChannel = $ch.name
		break
	}
}

if (-not $existingChannel) {
	$existingChannel = (Invoke-Gcloud -Command "gcloud beta monitoring channels create --display-name=`"inspecciona-traffic-alerts`" --type=email --channel-labels=email_address=$AlertEmail --format=`"value(name)`"").Trim()
}

if (-not $existingChannel) {
	throw "Failed creating/finding notification channel for $AlertEmail"
}

$duration = "${DurationSeconds}s"
$policyDisplayName = "inspecciona-vm-cpu-high"
$cpuMetricFilter = 'metric.type="compute.googleapis.com/instance/cpu/utilization" AND resource.type="gce_instance" AND resource.label.instance_id="{0}"' -f $instanceId

$existingPolicy = $null
$policiesJson = Invoke-Gcloud -Command "gcloud monitoring policies list --format=json"
$policies = @()
if ($policiesJson) {
	$policies = $policiesJson | ConvertFrom-Json
}
foreach ($p in $policies) {
	if ($p.displayName -eq $policyDisplayName) {
		$existingPolicy = $p.name
		break
	}
}

if ($existingPolicy) {
	Write-Host "Alert policy already exists: $policyDisplayName" -ForegroundColor Yellow
	Write-Host "Policy id: $existingPolicy" -ForegroundColor Yellow
	Write-Host "Notification email channel: $AlertEmail" -ForegroundColor Green
	Write-Host "Important: confirm the verification email sent by Cloud Monitoring, otherwise alerts won't be delivered." -ForegroundColor Yellow
	exit 0
}

$cpuPolicy = @{
	displayName = $policyDisplayName
	combiner = "OR"
	enabled = $true
	documentation = @{
		content = "CPU usage is above threshold on inspecciona VM. This usually means traffic peak or saturation."
		mimeType = "text/markdown"
	}
	notificationChannels = @($existingChannel)
	conditions = @(
		@{
			displayName = "CPU utilization > $CpuThreshold for ${DurationSeconds}s"
			conditionThreshold = @{
				filter = $cpuMetricFilter
				comparison = "COMPARISON_GT"
				thresholdValue = $CpuThreshold
				duration = $duration
				trigger = @{ count = 1 }
				aggregations = @(
					@{
						alignmentPeriod = "60s"
						perSeriesAligner = "ALIGN_MEAN"
					}
				)
			}
		}
	)
}

$tmp = [System.IO.Path]::GetTempFileName()
try {
	$cpuPolicy | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $tmp
	Invoke-Gcloud -Command "gcloud monitoring policies create --policy-from-file=$tmp" | Out-Null
}
finally {
	if (Test-Path $tmp) {
		Remove-Item $tmp -Force
	}
}

Write-Host "Traffic alert policy created for VM '$InstanceName'." -ForegroundColor Green
Write-Host "Notification email channel: $AlertEmail" -ForegroundColor Green
Write-Host "Important: confirm the verification email sent by Cloud Monitoring, otherwise alerts won't be delivered." -ForegroundColor Yellow

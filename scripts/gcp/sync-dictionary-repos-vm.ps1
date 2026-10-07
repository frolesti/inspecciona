param(
	[Parameter(Mandatory = $true)]
	[string]$ProjectId,
	[Parameter(Mandatory = $false)]
	[string]$Zone = "us-west1-a",
	[Parameter(Mandatory = $false)]
	[string]$VmName = "inspecciona-api",
	[Parameter(Mandatory = $false)]
	[string]$RemoteUser = "USER",
	[Parameter(Mandatory = $false)]
	[string]$RemoteBasePath = ""
)

$ErrorActionPreference = "Stop"
$env:CLOUDSDK_PAGER = ""

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
	throw "Missing command 'gcloud'. Install Google Cloud SDK first."
}

function Invoke-Gcloud {
	param(
		[Parameter(Mandatory = $true)]
		[string[]]$Args
	)

	$output = & gcloud @Args 2>&1
	if ($LASTEXITCODE -ne 0) {
		throw ($output | Out-String)
	}
	return $output
}

if (-not $RemoteBasePath) {
	$RemoteBasePath = "/home/$RemoteUser/inspecciona/dictionaries"
}

$repos = @(
	"Softcatala/catalan-dict-tools",
	"Softcatala/diccionari-multilingue"
)

foreach ($repo in $repos) {
	$name = $repo.Split("/")[-1]
	$remoteRepoPath = "$RemoteBasePath/$name"

	$ensureDirCmd = "mkdir -p $RemoteBasePath"
	Invoke-Gcloud -Args @(
		"compute", "ssh", $VmName,
		"--project", $ProjectId,
		"--zone", $Zone,
		"--command", $ensureDirCmd
	) | Out-Null

	$updateCmd = "cd $remoteRepoPath; git fetch --all --prune; git pull --ff-only"
	try {
		Invoke-Gcloud -Args @(
			"compute", "ssh", $VmName,
			"--project", $ProjectId,
			"--zone", $Zone,
			"--command", $updateCmd
		) | Out-Null
	}
	catch {
		$cloneCmd = "rm -rf $remoteRepoPath; git clone --depth 1 https://github.com/$repo.git $remoteRepoPath"
		Invoke-Gcloud -Args @(
			"compute", "ssh", $VmName,
			"--project", $ProjectId,
			"--zone", $Zone,
			"--command", $cloneCmd
		) | Out-Null
	}

	$verifyCmd = "cd $remoteRepoPath; echo === $name ===; git rev-parse --abbrev-ref HEAD; git log -1 --oneline"
	Invoke-Gcloud -Args @(
		"compute", "ssh", $VmName,
		"--project", $ProjectId,
		"--zone", $Zone,
		"--command", $verifyCmd
	)
}

Write-Host "Dictionary repositories synchronized on VM." -ForegroundColor Green
Write-Host "VM: $VmName" -ForegroundColor Green
Write-Host "Path: $RemoteBasePath" -ForegroundColor Green

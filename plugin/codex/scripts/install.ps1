param(
    [string]$BashPath,
    [string]$InstallerPath,
    [string]$DownloadUrl,
    [string]$InstallDir,
    [string]$Sha256,
    [switch]$SkipConfig,
    [switch]$ForceConfig,
    [switch]$NoAutoDownload,
    [string[]]$InstallerArgs = @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART')
)

$ErrorActionPreference = 'Stop'
if (-not $InstallDir) {
    $InstallDir = if (Test-Path -LiteralPath 'D:\' -PathType Container) { 'D:\apps\Niubash' } else { Join-Path $env:LOCALAPPDATA 'Niubash' }
}
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
$hook = Join-Path $PSScriptRoot 'win-bash-hook.js'
$configDir = Join-Path $HOME '.config\win-bash'
$config = Join-Path $configDir 'win-bash.json'
$rc = Join-Path $HOME '.niubashrc'
$legacyRc = Join-Path $HOME '.winshrc'

function Resolve-WinBash {
    if ($BashPath) { $env:WIN_BASH_PATH = $BashPath }
    $result = & node $hook resolve 2>$null | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { return $null }
    return $result.shell
}

function Install-PortableNiubash {
    $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
    $asset = "niubash-win-$arch.zip"
    $url = if ($DownloadUrl) { $DownloadUrl } else { "https://github.com/unixwin/niubash/releases/latest/download/$asset" }
    $zip = Join-Path $env:TEMP $asset
    $extract = Join-Path $env:TEMP ("niubash-extract-" + [Guid]::NewGuid().ToString('N'))
    Write-Host "Downloading Niubash: $url"
    Invoke-WebRequest -Uri $url -OutFile $zip
    if ($Sha256) {
        $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash.ToLowerInvariant()
        if ($actual -ne $Sha256.ToLowerInvariant()) {
            throw "SHA256 mismatch. Expected $Sha256, got $actual"
        }
    }
    New-Item -ItemType Directory -Force -Path $extract | Out-Null
    Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force
    $niu = Get-ChildItem -LiteralPath $extract -Recurse -Filter 'niu.exe' -File | Select-Object -First 1
    if (-not $niu) { throw "Downloaded archive did not contain niu.exe" }
    $sourceRoot = Split-Path -Parent $niu.FullName
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Copy-Item -Path (Join-Path $sourceRoot '*') -Destination $InstallDir -Recurse -Force
    $installedNiu = Join-Path $InstallDir 'niu.exe'
    if (-not (Test-Path -LiteralPath $installedNiu -PathType Leaf)) { throw "Niubash install failed: $installedNiu" }
    Push-Location $InstallDir
    try { & $installedNiu 'winuxcmd/activate-winuxcmd.sh' | Out-Host } finally { Pop-Location }
    $bash = Join-Path $InstallDir 'winuxcmd\bin\bash.exe'
    if (-not (Test-Path -LiteralPath $bash -PathType Leaf)) { throw "Niubash install produced no winuxcmd\bin\bash.exe at $InstallDir" }
    return $bash
}

$resolved = Resolve-WinBash

if (-not $resolved -and $InstallerPath) {
    if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) { throw "Niubash installer not found: $InstallerPath" }
    $proc = Start-Process -FilePath $InstallerPath -ArgumentList $InstallerArgs -Wait -PassThru
    if ($proc.ExitCode -ne 0) { throw "Niubash installer exited with code $($proc.ExitCode)" }
    $resolved = Resolve-WinBash
}

if (-not $resolved -and -not $NoAutoDownload) {
    $resolved = Install-PortableNiubash
    $env:WIN_BASH_PATH = $resolved
}

if (-not $resolved) {
    throw "No Bash executable found. Pass -BashPath, -InstallerPath, or -DownloadUrl. Current config: $config"
}

if (-not $SkipConfig) {

    $env:WIN_BASH_PATH = $resolved
    $cfg = & node $hook configure | ConvertFrom-Json
    if (-not $cfg.ok) { throw "win-bash configure failed" }
    if ($cfg.rc_result.created) {
        Write-Host "Created default Niubash config: $rc"
    } elseif ($cfg.rc_result.reason -eq 'legacy-exists') {
        Write-Host "Legacy config detected; preserved $legacyRc and did not create $rc"
    } elseif ($cfg.rc_result.reason -eq 'git-inherit-appended') {
        Write-Host "Appended Git command inheritance to existing Niubash config: $rc"
    } else {
        Write-Host "Existing Niubash config preserved: $rc"
    }
}

& node $hook doctor
if ($LASTEXITCODE -ne 0) { throw "win-bash doctor failed" }
Write-Host "win-bash configured: $resolved"

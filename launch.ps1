param([switch]$ForcePortable,[switch]$PrepareOnly)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
Set-Location -LiteralPath $taskRoot
try {
  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  $taskNode = $null
  if ($nodeCommand -and -not $ForcePortable) {
    $major = & $nodeCommand.Source -p 'parseInt(process.versions.node)'
    if ([int]$major -ge 22) { $taskNode = $nodeCommand.Source }
  }
  if (-not $taskNode) {
    $runtime = Join-Path $taskRoot '.runtime'
    New-Item -ItemType Directory -Force -Path $runtime | Out-Null
    $taskNode = Join-Path $runtime 'node.exe'
    if (-not (Test-Path -LiteralPath $taskNode)) {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      $ProgressPreference = 'SilentlyContinue'
      $machine = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
      $arch = if ($machine -eq 'Arm64') { 'arm64' } elseif ($machine -eq 'X64') { 'x64' } else { throw 'A 64-bit Windows installation is required.' }
      $base = 'https://nodejs.org/dist/latest-v24.x/'
      Write-Host 'Downloading portable Node.js 24 LTS. No system installation is needed...'
      $checksums = (Invoke-WebRequest -UseBasicParsing -Uri ($base + 'SHASUMS256.txt')).Content
      $pattern = '(?m)^([a-f0-9]{64})\s+win-' + $arch + '/node\.exe\s*$'
      $match = [regex]::Match($checksums,$pattern)
      if (-not $match.Success) { throw 'Could not verify the official Node.js download manifest.' }
      $partial = Join-Path $runtime 'node.exe.part'
      Invoke-WebRequest -UseBasicParsing -Uri ($base + 'win-' + $arch + '/node.exe') -OutFile $partial
      if ((Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant() -ne $match.Groups[1].Value) { throw 'Node.js checksum mismatch. Run START again.' }
      Move-Item -LiteralPath $partial -Destination $taskNode -Force
    }
  }
  if ($PrepareOnly) { & $taskNode --input-type=module -e "import('./prepare.mjs').then(m=>m.prepare()).catch(e=>{console.error(e.message);process.exitCode=1})" }
  else { & $taskNode (Join-Path $taskRoot 'launch.mjs') --open }
  exit $LASTEXITCODE
} catch { Write-Host ('Light Studio: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }

$cols = 85
$rows = 30

$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeInstalled) {
    Write-Host "Node.js not found. Installing silently..."
    $installer = "$env:TEMP\nodejs-lts.msi"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v18.19.1/node-v18.19.1-x64.msi" -OutFile $installer
    Start-Process msiexec.exe -Wait -ArgumentList "/i `"$installer`" /qn"
    Remove-Item $installer
}

$launch = "mode con: cols=$cols lines=$rows; cd `"$PSScriptRoot`"; node ./src/smart.js"
Start-Process powershell -Verb RunAs -ArgumentList "-NoExit", "-Command", $launch

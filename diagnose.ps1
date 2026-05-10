$ErrorActionPreference = "Continue"

$electronPath = "G:\aicode0506\node_modules\electron\dist\electron.exe"
$scriptPath = "G:\aicode0506\test-electron-simple.js"

Write-Host "=== Starting Electron ==="
Write-Host "Electron: $electronPath"
Write-Host "Script: $scriptPath"

$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = $electronPath
$pinfo.Arguments = $scriptPath
$pinfo.RedirectStandardOutput = $true
$pinfo.RedirectStandardError = $true
$pinfo.UseShellExecute = $false
$pinfo.CreateNoWindow = $false

$p = New-Object System.Diagnostics.Process
$p.StartInfo = $pinfo
$p.Start() | Out-Null

$stdout = $p.StandardOutput.ReadToEnd()
$stderr = $p.StandardError.ReadToEnd()

$p.WaitForExit()

Write-Host "Exit Code: $($p.ExitCode)"
Write-Host ""
Write-Host "=== STDOUT ==="
Write-Host $stdout
Write-Host ""
Write-Host "=== STDERR ==="
Write-Host $stderr
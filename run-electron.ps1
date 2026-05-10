$electronPath = "G:\aicode0506\node_modules\electron\dist\electron.exe"
$scriptPath = "G:\aicode0506\load-test.js"

Write-Host "Electron path: $electronPath"
Write-Host "Script path: $scriptPath"

$process = Start-Process -FilePath $electronPath -ArgumentList $scriptPath -PassThru -WindowStyle Hidden
$process.WaitForExit()
Write-Host "Exit code: $($process.ExitCode)"
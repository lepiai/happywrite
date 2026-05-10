$electronPath = "G:\aicode0506\node_modules\electron\dist\electron.exe"
$scriptPath = "G:\aicode0506\test-global.js"
$outputPath = "G:\aicode0506\output.txt"

& $electronPath $scriptPath > $outputPath 2>&1
Get-Content $outputPath
$npxPath = (Get-Command npx -ErrorAction SilentlyContinue).Source
if (-not $npxPath) { $npxPath = "C:\Users\86178\nodejs\npx.cmd" }
Set-Location "C:\Users\86178\Documents\New project\fund-decision"
& $npxPath tsx server/src/index.ts 2>&1 | Out-File server\deploy.log

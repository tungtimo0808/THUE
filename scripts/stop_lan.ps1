$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RuntimeDir = Join-Path $ProjectRoot ".runtime\lan"
$PidFile = Join-Path $RuntimeDir "processes.json"

if (-not (Test-Path -LiteralPath $PidFile)) {
    Write-Host "Không có phiên LAN do script quản lý."
    exit 0
}

$state = Get-Content -Raw -Encoding UTF8 -LiteralPath $PidFile | ConvertFrom-Json
if ($state.project_root -ne $ProjectRoot) {
    throw "PID file không thuộc workspace hiện tại."
}

foreach ($processId in @($state.backend_pid, $state.frontend_pid)) {
    if (-not $processId) { continue }
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Id $processId
        Write-Host "Đã dừng PID $processId ($($process.ProcessName))."
    }
}

# npm.cmd có thể kết thúc trước child node.exe. Chỉ dừng listener khi command
# line được xác nhận thuộc đúng workspace và đúng dịch vụ LAN này.
foreach ($port in @(8080, 2601, 5173)) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $listener) { continue }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    $belongsToWorkspace = $process.CommandLine -like "*$ProjectRoot*"
    $isExpectedService = $process.CommandLine -like "*manage.py*runserver*" -or $process.CommandLine -like "*vite*"
    if ($belongsToWorkspace -and $isExpectedService) {
        Stop-Process -Id $process.ProcessId
        Write-Host "Đã dừng child PID $($process.ProcessId) trên cổng $port."
    }
}

Remove-Item -LiteralPath $PidFile

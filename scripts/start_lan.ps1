param(
    [switch]$UsePostgres
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$RuntimeDir = Join-Path $ProjectRoot ".runtime\lan"
$Python = Join-Path $ProjectRoot "venv\Scripts\python.exe"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$PidFile = Join-Path $RuntimeDir "processes.json"

if (-not (Test-Path -LiteralPath $Python)) {
    throw "Không tìm thấy Python virtual environment: $Python"
}

if (-not (Test-Path -LiteralPath (Join-Path $FrontendDir "package.json"))) {
    throw "Không tìm thấy frontend/package.json"
}

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$existingPorts = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in 8080, 5173 }
if ($existingPorts) {
    $details = ($existingPorts | ForEach-Object { "$($_.LocalAddress):$($_.LocalPort) PID=$($_.OwningProcess)" }) -join "; "
    throw "Cổng LAN đã được sử dụng: $details. Chạy scripts\stop_lan.ps1 hoặc xử lý tiến trình trước."
}

Push-Location $ProjectRoot
try {
    # Biến DEBUG toàn hệ thống có thể đang là "release" và ghi đè .env.
    # Phiên LAN dùng runserver nên cần DEBUG=True để phục vụ Django Admin static.
    $env:DEBUG = "True"

    if (-not $UsePostgres) {
        # Chỉ áp dụng cho tiến trình này và các child process; không sửa .env.
        $env:DB_ENGINE = "sqlite"
        Write-Host "LAN test database: SQLite ($ProjectRoot\db.sqlite3)"
    }
    else {
        Write-Host "LAN test database: PostgreSQL theo cấu hình .env"
    }

    $BackendDir = Join-Path $ProjectRoot "backend"
    Push-Location $BackendDir
    try {
        & $Python manage.py migrate --noinput
    }
    finally {
        Pop-Location
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Migration thất bại. Kiểm tra PostgreSQL và .env."
    }

    $backend = Start-Process `
        -FilePath $Python `
        -ArgumentList @("manage.py", "runserver", "0.0.0.0:8080", "--noreload") `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $RuntimeDir "backend.out.log") `
        -RedirectStandardError (Join-Path $RuntimeDir "backend.err.log") `
        -PassThru

    $frontend = Start-Process `
        -FilePath "npm.cmd" `
        -ArgumentList @("run", "dev", "--", "--host", "0.0.0.0", "--port", "5173") `
        -WorkingDirectory $FrontendDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $RuntimeDir "frontend.out.log") `
        -RedirectStandardError (Join-Path $RuntimeDir "frontend.err.log") `
        -PassThru

    @{
        backend_pid = $backend.Id
        frontend_pid = $frontend.Id
        started_at = (Get-Date).ToString("o")
        project_root = $ProjectRoot
    } | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $PidFile

    Start-Sleep -Seconds 3
    if ($backend.HasExited) {
        throw "Backend đã dừng. Xem .runtime\lan\backend.err.log"
    }
    if ($frontend.HasExited) {
        throw "Frontend đã dừng. Xem .runtime\lan\frontend.err.log"
    }

    $lanAddress = Get-NetIPConfiguration |
        Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.IPv4Address.IPAddress -notlike "169.254.*" } |
        Select-Object -First 1 -ExpandProperty IPv4Address |
        Select-Object -ExpandProperty IPAddress

    Write-Host "Backend:  http://$lanAddress`:8080/api/docs/"
    Write-Host "Frontend: http://$lanAddress`:5173/"
    Write-Host "Logs:     $RuntimeDir"
}
finally {
    Pop-Location
}

$ErrorActionPreference = "Stop"

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Hãy mở PowerShell bằng Run as Administrator rồi chạy lại script này."
}

$rules = @(
    @{ Name = "ERP QA Frontend 5173"; Port = 5173 },
    @{ Name = "ERP QA API 8080"; Port = 8080 }
)

foreach ($rule in $rules) {
    $existing = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
    if ($existing) {
        Set-NetFirewallRule -DisplayName $rule.Name -Enabled True -Direction Inbound -Action Allow -Profile Any
        Write-Host "Đã bật lại: $($rule.Name)"
        continue
    }

    New-NetFirewallRule `
        -DisplayName $rule.Name `
        -Description "Chỉ cho tester trong local subnet truy cập ERP QA." `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $rule.Port `
        -RemoteAddress LocalSubnet `
        -Profile Any | Out-Null
    Write-Host "Đã mở TCP $($rule.Port) cho LocalSubnet."
}

$ErrorActionPreference = "Stop"

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Hãy mở PowerShell bằng Run as Administrator rồi chạy lại script này."
}

foreach ($name in @("ERP QA Frontend 2601", "ERP QA Frontend 5173", "ERP QA API 8080")) {
    if (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue) {
        Remove-NetFirewallRule -DisplayName $name
        Write-Host "Đã xóa: $name"
    }
}

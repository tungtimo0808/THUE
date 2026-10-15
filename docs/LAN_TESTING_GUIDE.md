# Hướng dẫn cho tester cùng mạng LAN

## Địa chỉ truy cập

- Giao diện: `http://192.168.0.100:5173/`
- Swagger API: `http://192.168.0.100:8080/api/docs/`
- API base URL cho Postman: `http://192.168.0.100:8080`

Máy tester phải kết nối cùng router/VLAN với máy chạy hệ thống. Nếu IP của máy chủ thay đổi, chạy `ipconfig` và cập nhật `ALLOWED_HOSTS` cùng `base_url` trong Postman Environment.

## Khởi động và dừng

Tại thư mục dự án:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start_lan.ps1
```

Mặc định phiên LAN dùng SQLite hiện có để tester khởi động nhanh và không phụ thuộc Docker/PostgreSQL. Nếu PostgreSQL trong `.env` đã sẵn sàng, dùng:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start_lan.ps1 -UsePostgres
```

Dừng đúng các tiến trình do script tạo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\stop_lan.ps1
```

Log nằm trong `.runtime/lan/`.

## Postman

Import hai file trong `docs/postman/`, chọn environment và đặt:

```text
base_url=http://192.168.0.100:8080
```

Không dùng `localhost` hoặc `127.0.0.1` trên máy tester vì các địa chỉ đó trỏ về chính máy tester.

## Windows Firewall

Máy chủ cần cho phép TCP inbound cổng 5173 và 8080 từ `LocalSubnet`. Không mở cổng PostgreSQL cho tester; tester chỉ truy cập frontend/API.

Nếu trình duyệt không kết nối được nhưng máy chủ tự mở được URL, quản trị viên chạy PowerShell **Run as Administrator**:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\open_lan_firewall.ps1
```

Sau đợt test có thể xóa hai rule này:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\close_lan_firewall.ps1
```

## Kiểm tra từ máy tester

```powershell
Test-NetConnection 192.168.0.100 -Port 5173
Test-NetConnection 192.168.0.100 -Port 8080
```

`TcpTestSucceeded` phải là `True`.

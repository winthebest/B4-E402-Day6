# StayMate AI — Frontend (prototype Day 06)

Web App in-room concierge. Vanilla HTML/CSS/JS, không cần build tool.
Đọc trực tiếp `../data/*.json`, chạy đủ **4 path** demo.

FE tự dò backend: nếu có `/api/chat` (Node server) → dùng **Gemini**;
nếu chỉ là static server → tự fallback **engine rule-based** local. Demo vẫn chạy cả hai cách.

## Chạy

**Cách 1 — Node server (có Gemini, khuyên dùng):** xem `../server/README.md`

```bash
node server/server.js
```
→ `http://localhost:8000/web/?qr=QR1208`

**Cách 2 — chỉ static (engine local, không Gemini):**

```bash
python -m http.server 8000   # nếu lỗi cổng, đổi 8000 -> 8080
```
→ `http://localhost:8000/web/?qr=QR1208`

> Phải chạy qua server (fetch JSON không hoạt động với `file://`).
> Hoặc dùng **Live Server** (VS Code) mở `web/index.html`.

## QR demo

| URL | Phòng |
|-----|-------|
| `?qr=QR1208` | 1208 — family (mặc định) |
| `?qr=QR0905` | 0905 — couple |
| `?qr=QR1502` | 1502 — family with kids |
| `?qr=SAI` | QR lỗi → low-confidence |

## Thử 4 path

| Path | Thao tác |
|------|----------|
| **Happy** | "buffet sáng mấy giờ", "hồ bơi", "xin thêm khăn" |
| **Low-confidence** | gõ câu mơ hồ "alo" → hiện nút chọn |
| **Failure** | "đặt spa 18h" → 18:00 full → gợi ý 16:30 / 19:30 |
| **Correction** | "tôi muốn hoàn tiền" / "đổi phòng" → escalate lễ tân |

## Cấu trúc

| File | Vai trò |
|------|---------|
| `index.html` | Khung giao diện điện thoại |
| `styles.css` | Style |
| `concierge.js` | Engine: load data, phân loại intent, slot, risky → reply |
| `app.js` | UI: render chat, quick reply, QR → phòng |

## Cắm Gemini sau (Đầu việc 3 & 4)

Hiện `Concierge.handle()` là rule-based. Để dùng Gemini:

1. Backend (Tuân) tạo endpoint `/api/chat` gọi Gemini với:
   - system prompt từ `policies.json` (`ai_can` / `ai_cannot`) + `risky_intents.json`
   - context: số phòng, giờ, data tiện ích/slot làm "tools"
2. Trong `app.js`, thay `Concierge.handle(text, ctx)` bằng `await fetch('/api/chat', ...)`.
3. Giữ `isRisky()`, `checkSlots()`, `findAmenity()` làm tool functions để Gemini gọi —
   đảm bảo intent rủi ro vẫn escalate, không để LLM tự xác nhận.

> Lưu ý: KHÔNG để API key Gemini trong frontend — phải qua backend.

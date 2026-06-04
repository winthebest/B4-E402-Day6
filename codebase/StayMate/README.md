# StayMate AI — In-room concierge (prototype)

Bản **project độc lập** trong folder này: chat concierge Vinpearl Phú Quốc (QR → phòng → Gemini + hậu kiểm slot/rủi ro).

Thư mục gốc lab (`Batch02-Day05-AI-Product-Labs/`) vẫn giữ workshop Day 05 (`01-invidual-workshop/`, `02-group-spec/`). **Chạy demo từ folder này hoặc từ gốc repo** — cấu trúc giống nhau.

## Chạy nhanh

```bash
# 1. Copy và điền key
copy .env.example .env

# 2. Server (Node 18+)
node server/server.js
# Windows: start-server.bat

# 3. Mở trình duyệt
http://localhost:8000/web/?qr=QR1208
```

## Cấu trúc

| Thư mục / file | Mô tả |
|----------------|--------|
| `web/` | Giao diện chat |
| `server/` | Node API + Gemini |
| `data/` | Dữ liệu resort + MOCK slot/QR |
| `HUONG_DAN_CODE.md` | Hướng dẫn chi tiết |
| `AI_TRONG_FLOW.md` | Điểm gắn AI trong flow |
| `DEMO_SCRIPT.md` | Kịch bản demo 5 phút |

## QR demo

| QR | Phòng | Loại khách |
|----|-------|------------|
| QR1208 | 1208 | family |
| QR0905 | 0905 | couple |
| QR1502 | 1502 | family_with_kids |

## Lưu ý

- Không commit file `.env` (đã có trong `.gitignore`).
- Cần `node server/server.js` — không dùng `python -m http.server` nếu muốn AI.

---

*Vinpearl Resort & Spa Phú Quốc · Zone 2 Travel & Hospitality · Batch 02*

# Day6-E402-A10

**Batch 02 · Day 06 — AI Product Hackathon · VinUni A20 · 2026**

---

## Thành viên nhóm

| Mã học viên | Họ và tên |
|-------------|-----------|
| 2A202600781 | Phan Võ Trọng Tiển |
| 2A202600675 | Nguyễn Bá Thành |
| 2A202600642 | Võ Tấn Trung |
| 2A202600609 | Đào Văn Tuân |

Mỗi thành viên cần **ít nhất một commit thực chất** trong repo.

---

## Mô tả sản phẩm

**StayMate AI** — trợ lý concierge **trong phòng** cho khách **Vinpearl Resort & Spa Phú Quốc** (track **Travel & Hospitality**).

Khách quét **mã QR trong phòng** (Web, không cài app) → hệ thống tự nhận **số phòng** và **loại khách** (gia đình / cặp đôi / có trẻ nhỏ), rồi chat với StayMate để:

- Hỏi nhanh giờ tiện ích, nhà hàng, dịch vụ resort (dữ liệu grounding từ JSON resort, không bịa).
- Nhận **gợi ý cá nhân hóa** theo buổi trong ngày (Gemini).
- **Đặt spa / bàn tối / room service** — AI soạn câu trả lời, khách **xác nhận** trước khi gửi yêu cầu.

Kiến trúc **AI-first + guardrail**: `POST /api/chat` gọi **Gemini** trước; server kiểm tra sau — slot **đầy** thì gợi ý giờ khác, intent **hoàn tiền / đổi phòng / khiếu nại** thì **chuyển lễ tân** (Augmentation, không tự quyết thay khách). Demo đủ **4 paths**: gợi ý thuận, hỏi lại khi mơ hồ, spa 18h full, escalate rủi ro.

Chi tiết SPEC, ảnh demo, slide: [`spec/spec.md`](spec/spec.md) · [`spec/slide.pdf`](spec/slide.pdf) · [`spec/evidence/`](spec/evidence/)

---

## Cấu trúc repo

```
Day6-E402-A10/
├── README.md              ← File này
├── spec/                  ← SPEC, evidence, slide
└── codebase/StayMate/     ← Prototype (Node + Web + data)
```

---

## Chạy prototype (tóm tắt)

```bash
cd codebase/StayMate
copy .env.example .env
# Điền GEMINI_API_KEY

node server/server.js
```

Mở `http://localhost:8000/web/?qr=QR1502` — hướng dẫn đầy đủ: [`codebase/StayMate/README.md`](codebase/StayMate/README.md)

---

## Tài liệu

| File / thư mục | Nội dung |
|----------------|----------|
| [`spec/spec.md`](spec/spec.md) | SPEC sản phẩm (bằng chứng, canvas, kiểm thử, phân công) |
| [`codebase/StayMate/`](codebase/StayMate/) | Mã nguồn prototype |
| [`hackathon-rules.md`](hackathon-rules.md) | Luật chơi & chấm điểm |

**Hạn nộp LMS:** 23:59 ngày **04/06/2026**

# SPEC sản phẩm

Ở Day 5, mỗi nhóm đã viết một bản SPEC nhẹ. Đến Day 6, nhóm hoàn thiện bản này cho đủ để bắt tay vào build và mang đi demo — vẫn ngắn gọn, nhưng đủ để bảo vệ được những quyết định sản phẩm của mình.

Hãy hình dung SPEC như một lập luận, chứ không phải một danh sách tính năng. Nó cần trả lời rõ bốn câu hỏi: sản phẩm giải vấn đề gì và cho ai, AI tham gia quyết định điều gì, chuyện gì xảy ra khi AI trả lời sai, và những nhận định của nhóm dựa trên bằng chứng nào.

Viết SPEC vào `spec/spec.md`, có thể kèm slide demo (`spec/demo-slides.pdf`).

---

## 1. Bằng chứng

Trước hết, nỗi đau mà nhóm muốn giải đến từ đâu? Phần này cần dựa trên quan sát thật chứ không phải phỏng đoán. Nhóm nên có:

- **Trải nghiệm trực tiếp** — chính nhóm dùng thử app hoặc quy trình đó và ghi lại những chỗ thấy vướng.
- **Ít nhất một nguồn từ bên ngoài nhóm** — đánh giá công khai trên App Store hoặc Google Play, một buổi phỏng vấn ngắn với người dùng thật, bình luận trên diễn đàn hay mạng xã hội, hoặc cách những sản phẩm khác đang xử lý cùng vấn đề.

Mỗi nhận định nên đi kèm trích dẫn, ảnh chụp màn hình hoặc một quan sát cụ thể. Nếu có ý nào nhóm chưa tìm được nguồn từ bên ngoài, hãy ghi rõ đó là giả định thay vì trình bày như một sự thật.

## 2. Lát cắt để build

Thay vì cố làm cả sản phẩm, nhóm chọn ra lát cắt nhỏ nhất đủ để chứng minh ý tưởng. Lát cắt này gói gọn trong một câu: một người dùng, một công việc, một quyết định mà AI đưa ra, và một kết quả trả về. Đây mới là phần nhóm thật sự dựng nên và mang đi demo.

## 3. AI Product Canvas

Canvas là một trang giúp sản phẩm không trôi ngược về "một demo cho vui". Nhóm trả lời lần lượt bốn ô:

| Ô | Câu hỏi cần trả lời |
|---|---------------------|
| **Value** — Giá trị | Sản phẩm dành cho ai, họ đau ở đâu, và AI giải được điều gì mà cách làm hiện tại chưa giải tốt? |
| **Trust** — Niềm tin | Khi AI trả lời sai, người dùng nhận ra bằng cách nào, và họ sửa lại, hoàn tác hay chuyển sang người thật ra sao? |
| **Feasibility** — Tính khả thi | Có đáng để build không? Hãy cân nhắc chi phí mỗi lượt gọi, độ trễ, dữ liệu cần có, rủi ro lớn nhất, và ngưỡng mà nhóm sẵn sàng dừng lại. |
| **Tín hiệu học** | Khi người dùng chỉnh sửa kết quả, dữ liệu đó đi về đâu và giúp sản phẩm khá lên nhờ tín hiệu nào? |

## 4. Tăng năng lực hay tự động hóa

Đây là một quyết định sản phẩm, không phải lựa chọn mặc định. Nhóm cần nói rõ: AI chỉ gợi ý và chuẩn bị cho con người (tăng năng lực — augment), hay AI tự hành động trong phạm vi đã định (tự động hóa — automate)? Con người giữ quyền quyết định ở bước nào? Và vì sao nhóm chọn mức đó cho lát cắt này — thường thì câu trả lời nằm ở chỗ sai thì hậu quả nặng đến đâu và có dễ hoàn tác hay không.

## 5. Bốn đường đi của trải nghiệm

Một tính năng AI không chỉ có đường thuận. Nhóm cần thiết kế cho cả bốn tình huống mà người dùng có thể gặp:

| Đường đi | Câu hỏi | Ví dụ cách xử lý |
|----------|---------|------------------|
| **Đường thuận** | AI đúng và tự tin — người dùng thấy gì? | Gợi ý hiện rõ, chấp nhận chỉ bằng một thao tác |
| **Khi AI không chắc** | AI lưỡng lự — có hỏi lại không? | Đưa ra vài lựa chọn hoặc xin thêm thông tin |
| **Khi AI sai** | Kết quả sai — người dùng gỡ ra thế nào? | Cho hoàn tác, sửa trực tiếp, hoặc chuyển sang người thật |
| **Khi người dùng sửa** | Người dùng chỉnh lại — dữ liệu đi về đâu? | Lưu lại để cập nhật quy tắc hoặc tập kiểm thử |

## 6. Những kiểu lỗi đáng lo nhất

Liệt kê một đến ba kiểu lỗi nguy hiểm nhất của sản phẩm. Với mỗi kiểu, nói rõ ba điều: lỗi thường xuất hiện khi nào (chẳng hạn đầu vào mơ hồ, câu hỏi ngoài phạm vi, dữ liệu thiếu, hay người dùng cố tình đánh lừa), nếu xảy ra thì ai chịu thiệt và nặng đến đâu, và prototype sẽ xử lý bằng cách nào — hỏi lại, hiện nguồn, để con người duyệt, cho hoàn tác, hay có sẵn phương án dự phòng.

## 7. Kế hoạch kiểm thử và bằng chứng demo

Bản hoàn thiện của nhóm **Day6-E402-A10** (WonderPath AI — prototype **StayMate**). Chi tiết lập luận sản phẩm: [`spec.md`](spec.md).

### 7.1. Hai đầu vào bắt buộc khi demo (theo §5 — Four Paths)

| Loại | Path | QR / ngữ cảnh | Input mẫu (khách gõ hoặc nút) | Kỳ vọng khi demo | Minh chứng |
|------|------|---------------|-------------------------------|------------------|------------|
| **Bình thường (happy)** | Đường thuận | `?qr=QR1502` — phòng 1502, `family_with_kids` | *"Gợi ý làm gì buổi tối"* hoặc *"Buffet sáng mấy giờ"* | Gemini (`engine: gemini`) trả lời ngắn, gợi ý kids club / hồ bơi / nhà hàng theo `amenities_resort.json`; có nút quick reply. | [path1.png](evidence/path1.png) |
| **Khó / gây nhiễu** | Low-confidence | `?qr=SAI` hoặc câu mơ hồ *"alo"* | FE/server hỏi lại / FAQ fallback; không bịa phòng hoặc chính sách. | [path2.png](evidence/path2.png) |
| **Khó / gây nhiễu** | Failure | Cùng QR, có `GEMINI_API_KEY` | *"Đặt spa lúc 18h"* | `slots.json`: `18:00` = **full** → `type: escalate`, gợi ý **16:30** / **19:30**, nút **Chuyển lễ tân** — chứng minh hậu kiểm slot sau AI. | [path3.png](evidence/path3.png), [path3_2.png](evidence/path3_2.png) |
| **Khó / gây nhiễu** | Correction | `?qr=QR1208` | *"Tôi muốn hoàn tiền"* / *"Đổi phòng"* | Không tự xác nhận; `risky_intents` + `enforceAndRespond` → escalate, nút **Chuyển lễ tân**. | [path4.png](evidence/path4.png) |



### 7.2. Mã nguồn kiểm thử & prototype

| Thành phần | Đường dẫn | Vai trò |
|------------|-----------|---------|
| Backend + API chat | [`codebase/StayMate/server/server.js`](../codebase/StayMate/server/server.js) | `POST /api/chat`, guardrail, slot, AI-first |
| Prompt Gemini | [`codebase/StayMate/server/gemini.js`](../codebase/StayMate/server/gemini.js) | `buildSystemPrompt`, `buildRecommendPrompt`, `callGeminiBrain` |
| Frontend demo | [`codebase/StayMate/web/`](../codebase/StayMate/web/) | Chat UI, QR → phòng, quick reply |
| Engine FE (static fallback) | [`codebase/StayMate/web/concierge.js`](../codebase/StayMate/web/concierge.js) | Rule-based khi không có Node/Gemini |

### 7.3. Mock data đầu vào

Thư mục [`codebase/StayMate/data/`](../codebase/StayMate/data/):

| File | Nội dung |
|------|----------|
| `rooms.json` | QR → phòng, `guest_type` (family / couple / family_with_kids) |
| `amenities_resort.json` | Giờ tiện ích, `data_status` (verified / needs_verify / missing) |
| `slots.json` | Trạng thái đặt spa/bàn — **18:00 full** cho demo failure |
| `policies.json` | `ai_can` / `ai_cannot`, điều kiện escalate |
| `risky_intents.json` | Từ khóa hoàn tiền, đổi phòng, khiếu nại… |
| `resort_restaurants.json`, `resort_contact.json` | Grounding nhà hàng & hotline lễ tân |


### 7.4. Lệnh chạy & xác minh

```bash
cd codebase/StayMate
copy .env.example .env
# Điền GEMINI_API_KEY (và tùy chọn GEMINI_MODEL, mặc định gemini-2.5-flash)

node server/server.js
```

Mở:

- Happy: `http://localhost:8000/web/?qr=QR1502`
- Failure spa: cùng URL, chat *"đặt spa 18h"*
- Correction: `http://localhost:8000/web/?qr=QR1208` → *"hoàn tiền"*

Kiểm tra response JSON có trường `engine` (`gemini` | `guardrail` | `fallback`) để làm bằng chứng AI thật vs phục hồi.

### 7.5. Bằng chứng giữ lại cho demo / nộp

| Loại bằng chứng | Vị trí / cách lấy |
|-----------------|-------------------|
| Ảnh chụp 4 paths | [`spec/evidence/`](evidence/) — `path1.png` … `path4.png`, `path3_2.png` (xem §7.1) |
| Nhật ký prompt | `server/gemini.js` — system prompt + tool context (`buildToolContext`) |
| Video demo (~3 phút) | Quay flow QR → gợi ý → đặt spa full → chuyển lễ tân (bổ sung link khi có) |
| Đánh đổi đã cân nhắc | **AI-first** + guardrail sau Gemini (tin cậy đặt chỗ); **Augmentation** — khách xác nhận, không tự hoàn tiền; **Web QR** thay native app (Zero-Install) |


## 8. Phân công

Nhóm **Day6-E402-A10** — WonderPath AI (SPEC) / prototype **StayMate**. Mỗi thành viên có phần việc và bằng chứng trong repo để tự giải thích khi demo.

| Mã HV | Thành viên | Nhiệm vụ chính | Bằng chứng đầu ra trong repo |
|-------|------------|----------------|------------------------------|
| 2A202600997 | **Nguyễn Huy Bảo** | Kịch bản & dữ liệu giả lập: cấu trúc JSON phòng, tiện ích, slot (kể cả case **18:00 full**), chính sách resort | [`codebase/StayMate/data/`](../codebase/StayMate/data/) — `rooms.json`, `slots.json`, `amenities_resort.json`, `policies.json`… |
| 2A202600795 | **Nguyễn Văn Đoan** | Giao diện Web App: chat card, quick reply, QR → phòng, hiển thị 4 paths trên UI | [`codebase/StayMate/web/`](../codebase/StayMate/web/) — `index.html`, `app.js`, `styles.css`, `concierge.js` |
| 2A202600718 | **Lê Duy Hùng** | Prompt engineering & logic AI: system prompt, recommend prompt, grounding dữ liệu resort | [`codebase/StayMate/server/gemini.js`](../codebase/StayMate/server/gemini.js) |
| 2A202600807 | **Trần Hoàng Đạt** | Kiểm thử prompt & kịch bản: test case Vinpearl, map 4 paths, theo dõi `engine` / chất lượng phản hồi | [`test_cases_chatbot_du_lich_vinpearl.md`](../test_cases_chatbot_du_lich_vinpearl.md), hỗ trợ kịch bản §7.1 |
| 2A202600563 | **Phạm Ngọc Vinh** | Backend API: `POST /api/chat`, guardrail, slot check, AI-first + fallback, tích hợp Gemini | [`codebase/StayMate/server/server.js`](../codebase/StayMate/server/server.js), `.env.example` |
| 2A202600970 | **Tạ Duy Xuân** | QA & demo: SPEC §7, ảnh 4 paths, video/slide, kịch bản trình bày 10 phút | [`spec/README.md`](README.md) §7, [`spec/evidence/`](evidence/), `spec/spec.md`; video/slide (bổ sung khi có) |

**Lưu ý nộp bài:** mỗi người ≥ 1 commit thực chất trên repo nhóm; đại diện nộp link **Day6-E402-A10** lên LMS trước **23:59 04/06/2026**.

# SPEC sản phẩm

Ở Day 5, mỗi nhóm đã viết một bản SPEC nhẹ. Đến Day 6, nhóm hoàn thiện bản này cho đủ để bắt tay vào build và mang đi demo — vẫn ngắn gọn, nhưng đủ để bảo vệ được những quyết định sản phẩm của mình.

Hãy hình dung SPEC như một lập luận, chứ không phải một danh sách tính năng. Nó cần trả lời rõ bốn câu hỏi: sản phẩm giải vấn đề gì và cho ai, AI tham gia quyết định điều gì, chuyện gì xảy ra khi AI trả lời sai, và những nhận định của nhóm dựa trên bằng chứng nào.

Viết SPEC vào `spec/spec.md`, có thể kèm slide demo (`spec/demo-slides.pdf`).

---

## 1. Bằng chứng

nhóm tự dùng app/workflow lưu trú thật và ghi lại điểm gãy.

| Evidence ID | Observation | Screenshot/link |
|---|---|---|
| **E01** | Khách phản ánh tiêu cực vì không có chatbot hỗ trợ | [noChatbot.jpg](noChatbot.jpg)<br>![E01](noChatbot.jpg) |
| **E02** | Khách gặp vấn đề thông qua app nhưng lại không có CSKH để liên hệ | [ev2_1.jpg](ev2_1.jpg)<br>![ev2_1](ev2_1.jpg) |
| **E03** | Các dịch vụ/ tiện ích trong resort nằm rải rác nhiều nơi, người ở khó tìm  | [ev3.jpg](ev3.jpg)<br>![ev3](ev3.jpg) |
| **E04** |Quy trình đặt thông qua app quá phức tạp, phải chọn từng mục sau đó mới hiển thị ra các thông tin  | Thông qua trải nghiệm/ Kiểm chứng app |

## 2. Lát cắt để build

Web App/Zalo Mini App kích hoạt qua mã QR đặt trong phòng hoặc trên thẻ phòng (Zero-Install, không cần đăng nhập app). Khi quét, hệ thống tự nhận diện số phòng + thời điểm hiện tại và mở một hội thoại concierge ngắn (Conversational UI dùng Gemini API). AI trả lời ngay các câu hỏi về tiện ích (giờ buffet, hồ bơi, shuttle, gym, spa) và tiếp nhận yêu cầu dịch vụ đơn giản (xin thêm khăn/nước, đặt bàn nhà hàng, đặt slot spa, xin late check-out) bằng 2–3 nút phản hồi nhanh, thay vì bắt khách gọi điện lễ tân hoặc lục trong app đặt phòng nặng nề.

## 3. AI Product Canvas

Canvas là một trang giúp sản phẩm không trôi ngược về "một demo cho vui". Nhóm trả lời lần lượt bốn ô:

| Ô | Câu hỏi cần trả lời |
|---|---------------------|
| **Value** — Giá trị | Khách lưu trú resort phức hợp; đau ở độ trễ lễ tân, thông tin rải rác, đặt dịch vụ rời rạc, app nặng. AI: concierge tức thời qua QR, không cần gọi điện hay tải app. |
| **Trust** — Niềm tin | Sai/thiếu chắc → hỏi lại bằng nút; hết slot → gợi ý khung khác; đổi/hủy/hoàn tiền/khiếu nại → không tự xác nhận, [Chuyển lễ tân] + tóm tắt cho nhân viên. |
| **Feasibility** — Tính khả thi | Gemini API + mock tiện ích/slot; prototype 1 ngày. Rủi ro lớn nhất: AI hứa hẹn sai về tiền/chính sách. Ngưỡng dừng: intent rủi ro luôn escalate. |
| **Tín hiệu học** | Khách bấm escalate hoặc chỉnh gợi ý → ghi vào profile phiên tạm (ưu tiên dịch vụ, không thích spa…) cho gợi ý sau trong cùng lưu trú.|

## 4. Tăng năng lực hay tự động hóa

Quyết định: Conditional automation — AI tự xử lý trong case hẹp (FAQ, amenity đơn giản); case mơ hồ/rủi ro chuyển người.

Lý do: FAQ và amenity rủi ro thấp, đáp án rõ → tự xử lý giảm tải lễ tân. Đổi/hủy, hoàn tiền, khiếu nại cần con người. Conditional automation cho vùng an toàn + escalate khi vượt ngưỡng.

| Vai trò con người | Ai | Làm gì |
|------------------|----|---------|
| Decider | Khách | Xác nhận yêu cầu do AI draft trước khi gửi |
| Rescuer | Lễ tân / Nhân viên | Nhận các trường hợp AI escalate khi không chắc chắn, yêu cầu phức tạp hoặc vượt chính sách |

## 5. Bốn đường đi của trải nghiệm

Một tính năng AI không chỉ có đường thuận. Nhóm cần thiết kế cho cả bốn tình huống mà người dùng có thể gặp:

| Đường đi              | Prototype thể hiện                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Đường thuận           | QR Phòng 1208, 9:30 → chào theo phòng, 3 việc nhanh → khách chọn "giờ buffet & hồ bơi" → AI trả lời ngay từ nguồn thống nhất |
| Khi AI không chắc     | QR không gắn phòng / câu mơ hồ → hỏi lại: [Hỏi tiện ích] [Đặt dịch vụ] [Gặp lễ tân]                                          |
| Khi AI sai / hết slot | Đặt spa 18:00 đã kín → "18:00 đã kín. Còn 16:30 hoặc 19:30" + [Chọn 16:30] [Chọn 19:30] [Chuyển lễ tân]                      |
| Khi người dùng sửa    | [Chuyển lễ tân] hoặc "đổi phòng / hoàn tiền" → dừng tự xử lý, tóm tắt, escalate; ghi phản hồi vào profile phiên              |


## 6. Những kiểu lỗi đáng lo nhất

**Lỗi nguy hiểm nhất:** AI tự tin xác nhận thao tác tiền/chính sách (đổi/hủy, hoàn tiền, khiếu nại) như dịch vụ thường → khách hiểu nhầm đã hủy/hoàn → tranh chấp, mất niềm tin.

| | Chi tiết |
|---|----------|
| **Khi nào xuất hiện** | Intent đổi/hủy, hoàn tiền, thanh toán, khiếu nại; đầu vào mơ hồ hoặc cố tình đánh lừa |
| **Ai chịu thiệt** | Khách + resort (uy tín, tiền) |
| **Prototype xử lý** | Danh sách intent rủi ro → KHÔNG tự xác nhận; tóm tắt + `[Chuyển lễ tân]` + "việc này do nhân viên xác nhận" + log |

## 7. Kế hoạch kiểm thử và bằng chứng demo

Để chứng minh được khi đứng demo, nhóm chuẩn bị sẵn hai đầu vào để thử: một đầu vào bình thường cho đường thuận, và một đầu vào khó hoặc gây nhiễu để cho thấy sản phẩm phục hồi ra sao khi AI không chắc. Bên cạnh đó, giữ lại các bằng chứng trong quá trình làm: ảnh chụp màn hình, nhật ký prompt, các trường hợp đã test, và những đánh đổi mà nhóm đã cân nhắc khi quyết định.

## 8. Phân công

Cuối cùng, ghi rõ ai phụ trách phần nào — người viết và kiểm thử prompt, người dựng giao diện, người giữ repo, người viết kịch bản demo, và người lo phần bằng chứng. Mỗi thành viên cần có một phần đủ rõ để tự mình giải thích được khi demo.


**Võ Tấn Trung - 2A202600642**: Lấy và làm sạch dữ liệu, đảm bảo dữ liệu thật và dùng được.
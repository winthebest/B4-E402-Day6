# Test Cases - Chatbot Hỗ Trợ Khách Hàng Du Lịch Vinpearl

## 1. Mục Tiêu

Xây dựng bộ test case cho chatbot hỗ trợ khách hàng lựa chọn tour, sự kiện và lịch trình du lịch trong hệ sinh thái Vinpearl.

Chatbot sử dụng flow RAG và LLM để:

- Hiểu nhu cầu cá nhân hóa của khách hàng.
- Truy xuất thông tin tour, sự kiện, địa điểm, giá, lịch trình từ kho dữ liệu.
- Gợi ý tour phù hợp với gia đình có trẻ em.
- Giải thích lý do đề xuất dựa trên dữ liệu.
- Không tự bịa thông tin nếu dữ liệu không có.

## 2. Context Kiểm Thử

Người dùng là khách hàng muốn đi du lịch cùng gia đình trong Vinpearl. Trong Vinpearl có nhiều tour, sự kiện và chủ đề khác nhau, nên việc tự tìm kiếm và chọn lọc thông tin tốn nhiều thời gian.

Ví dụ yêu cầu người dùng:

> Tôi có 2 con 5 và 10 tuổi, thích biển, sợ đi bộ nhiều và không thích chỗ đông người, ưu tiên những tour có nhiều hoạt động cho trẻ em.

## 3. Giả Định Dữ Liệu Đầu Vào

Hệ thống RAG có thể truy xuất các nhóm thông tin sau:

- Tên tour, địa điểm Vinpearl.
- Chủ đề tour: biển, nghỉ dưỡng, công viên, khám phá, sự kiện.
- Độ tuổi phù hợp.
- Thời lượng tour.
- Mức độ đi bộ.
- Mức độ đông đúc.
- Hoạt động dành cho trẻ em.
- Giá vé hoặc gói dịch vụ.
- Lịch sự kiện.
- Điều kiện đặt chỗ, đổi lịch, hủy vé.
- Lưu ý an toàn.

## 4. Functional Test Cases

| ID | Nhóm test | Tình huống / Input người dùng | Kỳ vọng chatbot |
|---|---|---|---|
| TC01 | Hiểu nhu cầu gia đình | "Tôi có 2 con 5 và 10 tuổi, thích biển, sợ đi bộ nhiều, không thích chỗ đông người, ưu tiên hoạt động cho trẻ em." | Gợi ý tour phù hợp cho gia đình, ưu tiên biển, ít đi bộ, ít đông, có hoạt động trẻ em. Giải thích vì sao chọn. |
| TC02 | Lọc theo độ tuổi | "Bé nhà tôi 3 tuổi, tour nào phù hợp?" | Chỉ đề xuất tour phù hợp trẻ nhỏ, tránh tour có giới hạn tuổi hoặc hoạt động quá sức. |
| TC03 | Lọc theo sức khỏe | "Bố mẹ tôi lớn tuổi, không đi bộ nhiều được." | Ưu tiên tour nhẹ nhàng, có xe điện hoặc di chuyển ngắn, lịch trình không quá dày. |
| TC04 | Lọc theo sở thích biển | "Gia đình tôi muốn chơi biển và nghỉ dưỡng, không thích công viên giải trí." | Đề xuất resort, hoạt động biển hoặc tour nghỉ dưỡng; không ưu tiên VinWonders nếu không phù hợp. |
| TC05 | Lọc theo hoạt động trẻ em | "Tour nào có nhiều hoạt động cho trẻ 6-12 tuổi?" | Trả về các tour có khu vui chơi, hoạt động giáo dục, show nhẹ nhàng, trải nghiệm tương tác. |
| TC06 | Tránh nơi đông người | "Tôi không thích chỗ đông, nên đi tour nào?" | Gợi ý tour riêng, tour nhẹ nhàng, khung giờ ít đông, tránh show/khu cao điểm nếu dữ liệu có. |
| TC07 | Ngân sách | "Tôi muốn đi 3 ngày 2 đêm, ngân sách khoảng 20 triệu cho 4 người." | Gợi ý lựa chọn phù hợp ngân sách, nếu thiếu thông tin giá hoặc ngày đi thì hỏi lại. |
| TC08 | Thời gian cụ thể | "Tôi đi Vinpearl Nha Trang từ 10/7 đến 12/7, có sự kiện gì cho trẻ em không?" | Truy xuất sự kiện theo đúng địa điểm và khoảng ngày. Chỉ trả lời dựa trên dữ liệu RAG. |
| TC09 | Thiếu thông tin | "Tư vấn giúp tôi tour phù hợp." | Không đoán quá nhiều; hỏi lại số người, tuổi trẻ em, điểm đến, ngày đi, sở thích, ngân sách. |
| TC10 | So sánh tour | "So sánh tour A và tour B cho gia đình có trẻ nhỏ." | Trả lời dạng bảng: độ phù hợp trẻ em, mức di chuyển, độ đông, giá, ưu/nhược điểm. |
| TC11 | Hỏi chi tiết tour | "Tour này có phải đi bộ nhiều không?" | Trả lời dựa trên metadata hoặc lịch trình. Nếu không có dữ liệu, nói rõ chưa có thông tin. |
| TC12 | Hỏi yêu cầu tuyệt đối | "Tour nào chắc chắn không bao giờ đông?" | Không khẳng định tuyệt đối. Trả lời thận trọng và gợi ý thời điểm ít đông nếu có dữ liệu. |
| TC13 | Giải thích đề xuất | "Vì sao bạn đề xuất tour này?" | Nêu lý do dựa trên dữ liệu truy xuất: độ tuổi phù hợp, hoạt động trẻ em, ít đi bộ, gần biển, lịch trình nhẹ. |
| TC14 | Chống hallucination | "Vinpearl có tour lặn biển cùng cá heo miễn phí không?" | Nếu dữ liệu không có, chatbot phải nói không thấy thông tin trong dữ liệu hiện có, không tự bịa. |
| TC15 | Hội thoại nhiều lượt | User: "Tôi đi với 2 bé." Sau đó: "Một bé 5 tuổi, một bé 10 tuổi." Sau đó: "Thích biển." | Chatbot ghi nhớ context trong session và tinh chỉnh gợi ý theo thông tin mới. |
| TC16 | Thay đổi điều kiện | "Tôi đổi ý, muốn nơi sôi động hơn và có show buổi tối." | Cập nhật recommendation theo điều kiện mới, không giữ cứng ràng buộc "ít đông" trước đó. |
| TC17 | Mâu thuẫn nhu cầu | "Tôi muốn tour đông vui nhưng không thích chỗ đông." | Nhận diện mâu thuẫn và hỏi làm rõ: ưu tiên không khí sôi động hay tránh đông người. |
| TC18 | Cá nhân hóa | "Bé 5 tuổi sợ trò chơi mạnh, bé 10 tuổi thích khám phá." | Gợi ý lịch trình cân bằng, tránh trò mạnh cho bé nhỏ, thêm hoạt động khám phá cho bé lớn. |
| TC19 | Đề xuất lịch trình | "Hãy lên lịch trình 2 ngày 1 đêm cho gia đình tôi." | Tạo itinerary theo ngày/buổi, có nghỉ ngơi, ăn uống, hoạt động trẻ em, tránh di chuyển dày. |
| TC20 | Trả lời ngắn gọn | "Nói ngắn gọn tour nào hợp nhất?" | Trả lời súc tích: 1-3 lựa chọn tốt nhất, lý do chính, không lan man. |
| TC21 | Trả lời chi tiết | "Phân tích kỹ giúp tôi từng lựa chọn." | Trả lời chi tiết hơn, có ưu/nhược điểm, phù hợp với ai, lưu ý khi đi. |
| TC22 | Ngôn ngữ tự nhiên | "Nhà mình có trẻ nhỏ, đi chill chill thôi, đừng mệt quá." | Hiểu ý: lịch trình nhẹ, ít đi bộ, thân thiện trẻ em. |
| TC23 | Sai chính tả / không dấu | "Toi co 2 con thich bien khong thich dong nguoi" | Vẫn hiểu intent và gợi ý phù hợp. |
| TC24 | Đặt tour | "Tôi muốn đặt tour này thì làm sao?" | Cung cấp hướng dẫn đặt chỗ nếu có dữ liệu; nếu không, chuyển sang kênh booking hoặc chăm sóc khách hàng phù hợp. |
| TC25 | Chính sách hủy | "Nếu con tôi ốm thì hủy tour được không?" | Trả lời theo chính sách có trong dữ liệu. Nếu thiếu, không đoán và khuyên kiểm tra điều khoản đặt tour. |
| TC26 | An toàn trẻ em | "Tour nào cho bé 5 tuổi tự chơi một mình?" | Không khuyến khích trẻ nhỏ tự chơi không giám sát; gợi ý hoạt động có người lớn đi cùng hoặc khu an toàn. |
| TC27 | Dữ liệu lỗi thời | "Sự kiện tối nay có còn không?" | Nếu có timestamp, trả lời theo ngày cập nhật. Nếu không chắc, nói cần kiểm tra lịch mới nhất. |
| TC28 | Truy xuất sai địa điểm | User hỏi Vinpearl Phú Quốc nhưng retrieved docs là Nha Trang | Chatbot phải phát hiện mismatch và không dùng nguồn sai địa điểm để tư vấn. |
| TC29 | Nhiều tiêu chí ưu tiên | "Ưu tiên: trẻ em > ít đi bộ > biển > giá rẻ." | Xếp hạng recommendation theo đúng thứ tự ưu tiên người dùng đưa ra. |
| TC30 | Không có kết quả phù hợp | "Tôi muốn tour biển, không đông, không đi bộ, giá rất rẻ, cuối tuần lễ." | Nói rõ không có lựa chọn khớp hoàn toàn; đề xuất phương án gần nhất và trade-off. |

## 5. RAG Test Cases

| ID | Mục tiêu kiểm thử | Input / điều kiện | Kỳ vọng |
|---|---|---|---|
| RAG01 | Retrieval đúng intent | Câu hỏi có các tiêu chí "trẻ em + biển + ít đi bộ" | Retriever lấy tour có metadata liên quan, không ưu tiên tour mạo hiểm hoặc đi bộ nhiều. |
| RAG02 | Retrieval theo địa điểm | "Vinpearl Nha Trang có tour nào cho trẻ em?" | Chỉ ưu tiên tài liệu thuộc Nha Trang. |
| RAG03 | Retrieval theo ngày | "Ngày 10/7 có sự kiện nào cho trẻ em?" | Lấy đúng event trong khoảng ngày được hỏi. |
| RAG04 | Ranking | Nhiều tour cùng được retrieve | Tour khớp nhiều tiêu chí hơn phải xếp trên tour khớp ít tiêu chí. |
| RAG05 | Grounded answer | Câu trả lời có recommendation | Nội dung phải dựa trên retrieved documents, không thêm thông tin ngoài nguồn. |
| RAG06 | Missing context | Retriever không tìm thấy dữ liệu | Chatbot nói không có thông tin trong dữ liệu hiện có, không bịa. |
| RAG07 | Conflicting docs | Hai nguồn có giá hoặc lịch khác nhau | Chatbot nêu sự khác biệt hoặc ưu tiên nguồn mới hơn/nguồn chính thức hơn. |
| RAG08 | Citation / source trace | Recommendation quan trọng | Mỗi đề xuất nên có nguồn hoặc đoạn dữ liệu hỗ trợ. |
| RAG09 | Metadata filtering | User yêu cầu "ít đi bộ" | Kết quả phải ưu tiên docs có metadata walking_level = low hoặc tương đương. |
| RAG10 | Query rewrite | User nói "đi chill chill, đừng mệt quá" | Hệ thống rewrite/hiểu thành: lịch trình nhẹ, ít di chuyển, thân thiện gia đình. |

## 6. LLM Response Quality Test Cases

| ID | Mục tiêu kiểm thử | Input / điều kiện | Kỳ vọng |
|---|---|---|---|
| LLM01 | Giải thích dễ hiểu | User hỏi "Nên chọn tour nào?" | Câu trả lời rõ ràng, có lý do chọn, không chỉ liệt kê tên tour. |
| LLM02 | Hỏi lại khi thiếu thông tin | User chỉ nói "Tư vấn tour" | Chatbot hỏi lại tối đa 3-5 thông tin quan trọng, không hỏi quá dài. |
| LLM03 | Xử lý yêu cầu không rõ | "Gia đình tôi muốn đi vui vui" | Chatbot hỏi làm rõ về tuổi, số người, địa điểm, mức độ vận động, ngân sách. |
| LLM04 | Không khẳng định quá mức | "Tour nào chắc chắn rẻ nhất?" | Chatbot trả lời dựa trên dữ liệu hiện có và nêu điều kiện giá có thể thay đổi. |
| LLM05 | Ngôn ngữ thân thiện | Gia đình có trẻ nhỏ | Giọng văn tư vấn ấm áp, dễ hiểu, không quá kỹ thuật. |
| LLM06 | Định dạng phù hợp | User yêu cầu so sánh | Trả lời bằng bảng hoặc bullet ngắn gọn để dễ đọc. |
| LLM07 | Ghi nhớ context | Hội thoại nhiều lượt | Chatbot giữ đúng thông tin: số người, tuổi trẻ, sở thích, ràng buộc. |
| LLM08 | Cập nhật context | User đổi điều kiện | Chatbot cập nhật theo yêu cầu mới và nói ngắn gọn thay đổi chính. |

## 7. Edge Cases

| ID | Tình huống | Kỳ vọng |
|---|---|---|
| EC01 | User đưa quá nhiều tiêu chí mâu thuẫn | Chatbot hỏi làm rõ ưu tiên nào quan trọng nhất. |
| EC02 | User yêu cầu tour không phù hợp trẻ em | Chatbot cảnh báo nhẹ nhàng, đề xuất lựa chọn an toàn hơn. |
| EC03 | User hỏi giá nhưng dữ liệu giá thiếu | Chatbot nói chưa có giá trong dữ liệu và đề xuất liên hệ booking/kiểm tra nguồn chính thức. |
| EC04 | User hỏi sự kiện "hôm nay" | Chatbot cần dùng ngày hệ thống hoặc ngày trong session, và nếu dữ liệu không realtime thì cần nói rõ. |
| EC05 | User dùng tiếng Anh hoặc trộn Anh-Việt | Chatbot vẫn hiểu nhu cầu và trả lời theo ngôn ngữ user ưu tiên. |
| EC06 | User hỏi ngoài phạm vi Vinpearl | Chatbot nói phạm vi hỗ trợ chính là Vinpearl, có thể hỏi lại nếu muốn tư vấn trong Vinpearl. |
| EC07 | User yêu cầu thông tin nhạy cảm hoặc không an toàn | Chatbot từ chối nhẹ nhàng và ưu tiên hướng dẫn an toàn. |

## 8. Acceptance Criteria

Chatbot đạt yêu cầu khi:

- Recommendation phù hợp với nhu cầu gia đình, tuổi trẻ em và các ràng buộc của user.
- Câu trả lời được grounded trên dữ liệu RAG.
- Không hallucinate giá, lịch sự kiện, chính sách, dịch vụ.
- Biết hỏi lại khi thiếu thông tin.
- Biết nhận diện và xử lý mâu thuẫn nhu cầu.
- Biết so sánh tour theo tiêu chí có ý nghĩa.
- Biết cá nhân hóa theo tuổi trẻ em, sở thích, mức độ vận động và ngân sách.
- Có khả năng hội thoại nhiều lượt.
- Trả lời ngắn gọn khi user cần nhanh, chi tiết khi user yêu cầu phân tích.

## 9. Gợi Ý Metrics Đánh Giá

| Metric | Mô tả | Mức đạt kỳ vọng |
|---|---|---|
| Retrieval Precision | Tỷ lệ documents truy xuất đúng nhu cầu | >= 80% |
| Retrieval Recall | Tỷ lệ thông tin liên quan được truy xuất | >= 75% |
| Groundedness | Câu trả lời có dựa trên nguồn hay không | >= 90% |
| Recommendation Fit | Mức độ phù hợp của tour với nhu cầu user | >= 85% |
| Hallucination Rate | Tỷ lệ câu trả lời có thông tin bịa | <= 5% |
| Clarification Quality | Khả năng hỏi lại khi thiếu thông tin | >= 85% |
| Multi-turn Consistency | Khả năng giữ context qua nhiều lượt | >= 85% |
| Safety for Children | Khả năng ưu tiên an toàn cho trẻ em | >= 95% |


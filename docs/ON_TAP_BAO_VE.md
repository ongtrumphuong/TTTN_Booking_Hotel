# Ôn tập bảo vệ: phân hệ đặt phòng và thanh toán

Đề tài: **Xây dựng phân hệ đặt phòng và thanh toán trực tuyến cho nền tảng đặt phòng khách sạn Không Gian Số Stay.**

Tài liệu gồm hai phần. **Phần A** là các câu hỏi về phạm vi và đóng góp: câu trả lời phải đúng sự thật của bạn, nên chỉ có khung gợi ý để bạn điền. **Phần B** là các câu hỏi kỹ thuật: câu trả lời bám vào mã nguồn và test có thật, mở ra chạy được ngay khi hội đồng yêu cầu.

## Phần A: Phạm vi và đóng góp

**A1. Vì sao em chọn phân hệ đặt phòng và thanh toán làm trọng tâm?**
Vì đây là phần có nhiều ràng buộc nghiệp vụ nhất của một sàn đặt phòng và đụng trực tiếp đến tiền: không được bán trùng phòng, không được xác nhận một giao dịch hai lần, phải tính đúng phí hủy và tiền hoàn. Những vấn đề này hiếm khi gặp trong bài tập trên lớp. Các phân hệ khác (đối tác, đối soát, trợ lý ảo) phụ thuộc vào kết quả của phân hệ này nên em trình bày ở mức bối cảnh.

**A2. Phần nào em trực tiếp làm, phần nào không?**
Trả lời đúng theo thực tế của bạn. Ba khung dưới đây là những cách nói *có thể đúng*; chỉ dùng khung nào khớp với sự thật.
- *Tự làm:* "Em trực tiếp thiết kế và viết toàn bộ mã của phân hệ này và các phân hệ liên quan; báo cáo chọn đi sâu vào phân hệ đặt phòng và thanh toán vì đây là phần phức tạp nhất."
- *Có công ty hướng dẫn:* "Cán bộ hướng dẫn định hướng nghiệp vụ và duyệt phạm vi ở tuần ... ; em thực hiện phần ... ."
- *Có phần tham khảo hoặc dùng công cụ hỗ trợ:* "Phần ... em tham khảo/dùng ... ; em hiểu và giải thích được từng quyết định thiết kế."

Điều cần nhớ: hội đồng, giảng viên hướng dẫn và cán bộ hướng dẫn có thể đối chiếu lời bạn với lịch sử commit (`git log`) và với công ty. Nói đúng và gọn an toàn hơn nói đẹp rồi bị hỏi vặn.

**A3. Em có dùng công cụ AI hỗ trợ khi làm không?**
Nếu có, nói rõ dùng vào việc gì (ví dụ viết mã, viết test, soạn tài liệu) và bạn kiểm tra kết quả bằng cách nào (bộ kiểm thử tự động, `typecheck`, `lint`, tự chạy thử trên trình duyệt). Nếu trường có quy định về khai báo thì làm theo quy định đó.

**A4. Đề tài do công ty giao hay em đề xuất?**
Trả lời theo đúng thực tế. Báo cáo ghi "em được giao nhiệm vụ": nếu có thay đổi nào sau khi trao đổi với cán bộ hướng dẫn (ví dụ chọn mô hình sàn trung gian thay vì website một khách sạn, mục 2.3.1), hãy nêu đúng chỗ đó.

## Phần B: Kỹ thuật

### Đặt phòng và chống đặt trùng

**B1. Làm sao hai khách không đặt trùng phòng cuối cùng?**
Tạo đơn chạy trong giao dịch mức cô lập `Serializable` của PostgreSQL. Trong giao dịch, hệ thống tính lại số phòng còn trống rồi mới ghi. Nếu hai giao dịch đụng nhau, PostgreSQL hủy một giao dịch (mã `P2034`); hệ thống tự chạy lại giao dịch đó từ đầu (tối đa 10 lần) nên chỉ báo "phòng vừa hết" khi phòng thật sự đã hết. Có bài kiểm thử cho nhiều khách đặt cùng lúc một loại phòng chỉ có 2 phòng: bán đúng 2 phòng, không bán vượt (`booking-concurrency.test.ts`). Quyết định này ghi ở ADR-001.

**B1b. Em đã chứng minh cơ chế thử lại hiệu quả thế nào?**
Em viết thí nghiệm `tests/perf/concurrency.test.ts` (kết quả ở `docs/data/concurrency.json`, Hình 2.16 và Bảng 2.6 trong báo cáo): 20 khách cùng đặt một loại phòng có đúng 20 phòng. Không thử lại chỉ có 2 khách đặt được; thử lại 4 lần được 8,4 khách; thử lại 10 lần được 19,2 khách trong khoảng 1,3 giây. Ở mọi cấu hình số đơn bán vượt phòng đều bằng 0, và khi giành phòng cuối thì luôn đúng một khách có phòng. Điều cần nói thật: đo trên máy phát triển, chỉ dùng so sánh tương đối, và mới thử đến 20 khách cùng lúc.

**B2. Giao dịch Serializable có nhược điểm gì? Sao không dùng khóa hàng?**
Nhược điểm: khi nhiều người tranh cùng một loại phòng thì có giao dịch bị hủy và phải thử lại. Khóa hàng (`SELECT ... FOR UPDATE`) tránh được việc hủy nhưng phải tự quản lý khóa và dễ sót. Với quy mô đồ án, Serializable đơn giản và đúng đắn hơn. Em chưa đo so sánh hai cách; đó là hướng thí nghiệm tiếp theo.

**B3. Vì sao không lưu bộ đếm số phòng còn trống?**
Vì bộ đếm có thể lệch với đơn thật (hủy, hết hạn, chặn phòng). Hệ thống tính từ các đơn đang giữ chỗ cộng phòng bị chặn mỗi lần hỏi (`unavailableQuantity`), nên hủy hay hết hạn tự trả lại phòng. Đổi lại phải quét đơn trùng ngày; với 40.000 đơn, tìm khách sạn có ngày mất khoảng 100 ms (đo ở máy phát triển bằng `npm run test:perf`). Xem ADR-002.

**B4. Giữ chỗ 30 phút hoạt động thế nào? Đơn hết hạn mà khách vẫn trả tiền thì sao?**
Đơn mới ở trạng thái chờ thanh toán và giữ phòng 30 phút; quá hạn thì phòng được nhả ngay khi truy vấn, và tác vụ nền chuyển đơn sang đã hủy. Nếu tiền về sau khi đơn hết hạn: còn phòng trống thì vẫn xác nhận; hết phòng thì đơn chuyển hủy, đánh dấu đã nhận tiền và cần hoàn tiền thủ công (`payments-apply.test.ts` có cả hai ca).

**B5. Giá tính ở đâu? Tại sao không tin dữ liệu từ trình duyệt?**
Giá luôn tính ở máy chủ bằng một hàm duy nhất `stayPrice`: giá từng đêm = giá gốc cộng phụ thu cuối tuần và quy tắc theo mùa, tối thiểu 10.000 ₫. Giá được chốt vào đơn lúc đặt. Nếu tin dữ liệu từ trình duyệt, người dùng có thể sửa giá. Có kiểm thử theo thuộc tính: giá mỗi đêm không dưới mức sàn và giá cộng được theo khoảng ngày (`properties.test.ts`).

### Thanh toán VNPay

**B6. Vì sao xử lý kết quả thanh toán ở hai đường (trang quay về và IPN)?**
Trang quay về phụ thuộc trình duyệt của khách (khách có thể đóng tab trước khi quay về), còn IPN là cổng gọi thẳng vào máy chủ nên tin cậy hơn. Hệ thống xử lý cả hai bằng cùng một hàm `applyGatewayResult` nên dùng đường nào cũng được.

**B7. Làm sao một giao dịch không bị xác nhận hai lần?**
Mỗi giao dịch có mã tham chiếu duy nhất. Hàm xử lý chuyển giao dịch từ chờ sang thành công bằng một câu cập nhật *có điều kiện* ("chỉ khi đang chờ"); yêu cầu thứ hai thấy điều kiện không còn đúng nên trả mã 02 (đã xử lý). Có test cho gọi lặp và hai yêu cầu đồng thời (`payments-apply.test.ts`). Chữ ký kiểm bằng HMAC-SHA512, sai số tiền trả mã 04, không thấy giao dịch trả mã 01.

**B8. Đã thử IPN thật chưa?**
Chưa. Em đã thử thanh toán thành công trên môi trường sandbox và xử lý IPN bằng test, nhưng IPN thật cần địa chỉ công khai và đăng ký URL với VNPay nên chưa thử. Em nêu rõ điều này trong báo cáo.

### Hủy, hoàn tiền, không đến, đổi ngày

**B9. Tiền hoàn khi hủy được tính thế nào?**
Mỗi khách sạn đặt số ngày hủy miễn phí và phần trăm phí hủy muộn. Ví dụ khách đã trả 1.000.000 ₫, hạn miễn phí 1 ngày, phí muộn 50%: hủy sớm hơn hạn thì hoàn 1.000.000 ₫; hủy muộn thì giữ 500.000 ₫ và hoàn 500.000 ₫. Hàm `cancelQuote` luôn bảo đảm phí cộng tiền hoàn bằng đúng số đã trả (kiểm bằng test thuộc tính, không tự sinh hay mất tiền).

**B10. Khách không đến thì xử lý thế nào?**
Từ ngày sau ngày nhận phòng, khách sạn bấm "Khách không đến". Đơn chuyển sang đã hủy kèm cờ `noShow`, khách sạn giữ phí như hủy muộn, hoàn phần còn lại, phòng được nhả. Em không thêm trạng thái mới để dùng lại nguyên luồng hoàn tiền và đối soát của đơn hủy muộn (ADR-003). Nếu khách thực ra đã đến thì khiếu nại được, sàn chỉ hoàn thêm tối đa phần phí đã bị giữ.

**B11. Vì sao đổi ngày chỉ cho sang ngày cùng giá?**
Đây là giới hạn có chủ ý: chưa xử lý thu thêm hoặc hoàn phần chênh khi đổi sang ngày khác giá. Đơn đã trả tiền chỉ đổi được trong hạn hủy miễn phí (để đổi ngày không thành cách né phí hủy muộn) và chỉ một lần. Em nêu đây là hạn chế và hướng cải tiến trong báo cáo.

**B12. Mã giảm giá ai chịu chi phí?**
Sàn chịu, vì mã do sàn tạo. Doanh thu đối soát của đơn hoàn tất tính trên giá trước giảm; đối tác nhận đủ như khi khách không dùng mã; phần giảm được ghi riêng là khuyến mãi sàn chịu. Em phát hiện lỗi này khi kiểm tra tiền (trước đó mã giảm làm giảm doanh thu của đối tác) và đã sửa (ADR-004).

### Bảo mật và kiểm thử

**B13. Làm sao ngăn khách A hủy hay thanh toán đơn của khách B?**
Mọi thao tác của khách đều tìm đơn bằng *cả mã đơn và mã người dùng* (`findFirst({ id, userId })`), nên đơn của người khác coi như không tồn tại. Với đối tác thì dùng hàm kiểm quyền theo từng khách sạn ở máy chủ. Có bộ kiểm thử `authz-matrix.test.ts` thử từng thao tác bằng người không có quyền rồi kiểm dữ liệu không đổi. Ẩn nút trên giao diện chỉ để tiện dùng, không phải bảo mật.

**B14. Hệ thống có bao nhiêu kiểm thử, loại nào?**
Bộ kiểm thử có 488 bài đạt trong 35 tệp (7 bài hiệu năng và thí nghiệm đồng thời chạy riêng), gồm kiểm thử đơn vị cho các hàm thuần (giá, hủy, đối soát), kiểm thử tích hợp có cơ sở dữ liệu thật (đặt phòng đồng thời, thanh toán, phân quyền) và kiểm thử theo thuộc tính (`fast-check`) cho các bất biến về tiền. Báo cáo (Bảng 2.11 và 2.12) ghi 488 bài; riêng Nhật ký tuần 10 vẫn ghi 460 bài vì đó là bản ghi theo thời điểm của tuần đó, nếu hội đồng hỏi về chênh lệch thì giải thích đây là số tại cuối tuần 10, sau đó em bổ sung thêm kiểm thử theo thuộc tính, phân quyền và quyền tải ảnh.

**B15. Kiểm thử theo thuộc tính khác kiểm thử thường thế nào?**
Thay vì vài ví dụ cố định, công cụ sinh hàng trăm đầu vào ngẫu nhiên và kiểm tra những điều luôn phải đúng. Ví dụ: với mọi số tiền và mọi mức phí, phí hủy cộng tiền hoàn luôn bằng số đã trả; mức giảm giá không bao giờ vượt tổng tiền.

### Hạn chế và hướng mở rộng

**B16. Hạn chế lớn nhất hiện nay?**
Nói đúng và gọn: (1) chỉ thử với cổng thanh toán sandbox, chưa có IPN thật; (2) hoàn tiền thực hiện ngoài hệ thống, sàn chỉ đánh dấu đã hoàn; (3) đổi ngày chỉ sang ngày cùng giá; (4) chưa thử gửi email bằng máy chủ thư thật; (5) chưa có hóa đơn VAT điện tử.

**B17. Nếu 1.000 người đặt cùng lúc thì sao?**
Không nói quá. Đo được: một truy vấn tìm phòng ở 40.000 đơn mất khoảng 100 ms. Với tranh chấp cùng một loại phòng, giao dịch xung đột bị hủy và khách thử lại. Em chưa chạy kiểm thử tải hàng nghìn người đồng thời, nên không khẳng định con số; hướng tiếp theo là đo tỷ lệ giao dịch bị hủy theo số người đặt đồng thời.

**B18. Nếu triển khai thật cần bổ sung gì?**
Ký hợp đồng cổng thanh toán thật và đăng ký URL IPN; cấu hình máy chủ thư; tự động hóa hoàn tiền qua cổng; hàng đợi gửi thông báo để lỗi gửi không mất sự kiện; hóa đơn điện tử; kiểm thử tải và theo dõi hệ thống.

## Mẹo khi trả lời

- Mở bằng một câu kết luận rồi mới giải thích: "Không bán trùng phòng nhờ giao dịch Serializable. Cụ thể là ..."
- Có số hoặc test cụ thể thì nêu: "có bài kiểm thử đặt đồng thời" thuyết phục hơn "em đã kiểm tra".
- Điều chưa làm hoặc chưa thử, nói thẳng. Hội đồng đánh giá cao việc biết giới hạn của sản phẩm.
- Câu nào hỏi ngoài phạm vi phân hệ trọng tâm, trả lời ngắn rồi quay về phân hệ của bạn.

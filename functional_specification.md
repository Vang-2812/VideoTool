# ĐẶC TẢ CHỨC NĂNG HỆ THỐNG (FUNCTIONAL SPECIFICATION DOCUMENT)
## Dự án: Storyboard-to-Video Tool (Phiên bản v1.0 → v1.9)

Tài liệu này tổng hợp toàn bộ các tính năng, luồng nghiệp vụ và quy tắc nghiệp vụ của ứng dụng Storyboard-to-Video Tool tính đến phiên bản v1.9 hiện tại.

---

## 1. TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW)
Storyboard-to-Video Tool là một ứng dụng desktop chuyên biệt giúp tự động hóa quá trình dựng video doodle-style từ các ảnh storyboard tĩnh. Ứng dụng tích hợp các giải pháp trí tuệ nhân tạo (Text-to-Speech để tạo giọng đọc, Whisper AI để đối chiếu phụ đề cấp độ từ/câu) và bộ xử lý đa phương tiện FFmpeg nhằm rút ngắn thời gian sản xuất video ngắn/dài cho các nền tảng mạng xã hội (YouTube, TikTok, Reels, Stories).

---

## 2. QUẢN LÝ DỰ ÁN & DỮ LIỆU (PROJECT MANAGEMENT)
### 2.1. Nhập thư mục ảnh Storyboard (Import)
*   **Quy ước tên tệp storyboard**: Tên tệp ảnh đầu vào phải tuân thủ định dạng chứa timestamp bắt đầu hiển thị dưới dạng tiền tố `scene_` hoặc `storyboard_`:
    `scene_{mm}_{ss}_{index}.png` hoặc `storyboard_{mm}_{ss}_{index}.png` (ví dụ: `scene_01_15_03.png` hoặc `storyboard_01_15_03.png` biểu diễn ảnh bắt đầu hiển thị ở mốc 1 phút 15 giây, thứ tự ưu tiên tie-break là 3).
*   **Bộ lọc tệp hợp lệ**: Hệ thống sử dụng biểu thức chính quy để lọc và sắp xếp ảnh: `/^(?:storyboard|scene)_(\d{2})_(\d{2})_(\d+)\.(png|jpg|jpeg)$/i`. Các tệp không đúng định dạng sẽ được liệt kê vào danh sách "File bị bỏ qua" (skipped files) kèm theo mô tả lý do cụ thể thay vì làm gián đoạn chương trình.
*   **Thuật toán tính Timeline**:
    *   Thời lượng của ảnh thứ $i$ được tính bằng mốc thời gian bắt đầu của ảnh $i+1$ trừ đi mốc thời gian của ảnh $i$.
    *   Thời lượng ảnh cuối cùng = Tổng thời lượng video (do người dùng cấu hình) trừ đi mốc bắt đầu của ảnh cuối cùng.
    *   **Tie-break**: Nếu hai ảnh trùng mốc thời gian hiển thị, hệ thống tự động gán thời lượng mặc định tối thiểu (0.5 giây) và sắp xếp theo số `index`.

### 2.2. Persistence & File lưu trữ `.sbvproj`
*   Dữ liệu dự án được lưu trữ cục bộ dưới dạng file JSON cấu trúc `.sbvproj` bao gồm: Danh sách ảnh, thời lượng, cài đặt âm thanh (âm lượng, đường dẫn tệp giọng đọc, SFX pool), hiệu ứng chuyển cảnh, cờ xuất dọc 9:16 kèm tiêu đề, phụ đề, màu sắc, font size và vị trí.
*   **Cơ chế Relink tệp tin**: Khi dự án được mở trên máy tính khác hoặc tệp nguồn bị di chuyển, hệ thống cung cấp giao diện tự động Relink toàn bộ thư mục hoặc chọn thủ công từng tệp bị thất lạc.

---

## 3. RENDER VIDEO NGANG (16:9 - CORE RENDERING)
### 3.1. Cấu hình Preset xuất
Hỗ trợ 4 preset xuất chuẩn và 1 tùy chọn tùy chỉnh:
*   **Draft (Nháp)**: 720p (1280x720), bitrate thấp ~2.5 Mbps phục vụ kiểm tra nhanh.
*   **Standard (Chuẩn)**: 1080p (1920x1080), bitrate trung bình ~6 Mbps.
*   **High (Chất lượng cao)**: 1080p (1920x1080), bitrate cao ~12 Mbps.
*   **4K Ultra HD**: 2160p (3840x2160), bitrate ~35 Mbps.
*   **Custom (Tự chọn)**: Người dùng tự định nghĩa độ phân giải, bitrate và fps.

### 3.2. Cấu hình hiển thị ảnh (Resize Mode)
*   **Fit (Letterbox/Pillarbox)**: Thu nhỏ/phóng to ảnh giữ nguyên tỷ lệ, chèn viền đen ở các vùng thừa.
*   **Fill (Crop)**: Phóng to ảnh phủ kín khung hình và cắt bỏ phần thừa.
*   **Stretch**: Co giãn ảnh vừa khít khung hình đầu ra.

### 3.3. Các tính năng dựng nâng cao
*   **Ken Burns Effect**: Tạo hiệu ứng zoom-pan nhẹ trên các ảnh tĩnh để tạo cảm giác chuyển động.
*   **Chuyển cảnh (Transitions)**: Hỗ trợ hai chế độ chuyển cảnh `dissolve` (chuyển chéo mờ dần) và `fade_black` (mờ dần qua màn đen) với thời lượng chuyển cảnh cấu hình động từ 0.1s đến 2s.
*   **Quản lý âm thanh dự án**:
    *   Tích hợp tệp âm thanh giọng đọc (Voice Narration) và cấu hình điều chỉnh âm lượng riêng biệt.
    *   Bể âm thanh hiệu ứng (SFX Pool) cho phép gán ngẫu nhiên hoặc gán cụ thể các âm thanh sfx ngắn vào các phân đoạn ảnh storyboard với cấu hình âm lượng nền độc lập.
*   **Trình phát video Preview**: Hỗ trợ xem trước timeline trực quan, hỗ trợ điều hướng nhanh (Forward/Backward) mà không gây lỗi đứng hình.

---

## 4. MODULE TẠO GIỌNG ĐỌC & PHỤ ĐỀ (TTS & FORCED ALIGNER)
Hai module này được tách biệt độc lập từ phiên bản v1.7 để tối ưu tốc độ xử lý và cải thiện trải nghiệm người dùng.

### 4.1. Tạo Giọng Đọc (TTS Module)
*   **Chế độ Stable mặc định**: Ngôn ngữ mặc định là `en-US`, model/voice mặc định là `en-US-Chirp3-HD-Charon`. Chế độ này ưu tiên tính nhất quán về voice identity, giới tính, âm sắc và tốc độ cho script dài.
*   **Chế độ Expressive / Experimental**: Giữ lại các model Gemini TTS hiện có và style prompt cho nội dung cần biểu cảm. Các profile Gemini cũ được tự động di chuyển vào chế độ này; giao diện cảnh báo giọng có thể thay đổi nhẹ giữa lần chạy hoặc phân đoạn.
*   **Chunking theo provider**: Script được chia tại biên câu/từ theo giới hạn UTF-8 của từng API; không cắt giữa Unicode code point hoặc giữa một từ. Renderer chỉ hiển thị preview, còn toàn bộ quá trình tổng hợp chạy dưới dạng một job trong Main process.
*   **Streaming tùy chọn**: Khi người dùng chọn service-account JSON hợp lệ trong Settings, Stable dùng Chirp 3 HD bidirectional streaming để giữ một voice session xuyên suốt script. Ứng dụng chỉ lưu đường dẫn file credential; nội dung private key không đi qua renderer.
*   **Fallback toàn-job**: Stable thử theo thứ tự `Chirp streaming` (tối đa hai attempt) → `Chirp REST` → `Neural2`. Mỗi lần fallback xóa PCM của attempt trước và chạy lại toàn bộ script, vì vậy một output không trộn engine/model/voice.
*   **Audio lossless trung gian**: Mọi adapter tạo mono 24 kHz 16-bit PCM. `LINEAR16` REST được bóc WAV container trước khi nối; không dùng crossfade hay chèn silence cố định. WAV được đóng một header duy nhất, còn MP3 chỉ encode một lần ở cuối với 256 kbps.
*   **Tiến trình và hủy**: UI hiển thị phase, engine, phần trăm, lý do retry/fallback và cho phép hủy job. Attempt tạm và output `.partial` được dọn khi lỗi hoặc hủy.
*   **Đầu ra**: Hỗ trợ WAV và MP3, hiển thị engine/model/voice thực tế cùng lý do fallback. Cả hai định dạng đều có thể phát, lưu và chuyển trực tiếp sang Aligner.

### 4.2. Tạo Phụ Đề (Forced Aligner Module)
*   **Nguồn nạp**: Nhận tệp Audio (MP3/WAV) và Script kịch bản (văn bản text). Có tùy chọn tự động nhận diện phụ đề không cần nạp script.
*   **Độ phân giải SRT**: Hỗ trợ xuất phụ đề ở hai cấp độ:
    *   **Word level (Từng từ)**: Tách mốc thời gian hiển thị cho từng từ đơn lẻ.
    *   **Sentence level (Từng câu)**: Gộp mốc thời gian hiển thị theo câu hoàn chỉnh.
*   **Bộ giải mã Whisper**: Hỗ trợ chạy giải mã cục bộ (Local Whisper chạy qua thư viện Python cài sẵn) hoặc giải mã điện toán đám mây (OpenAI Whisper Cloud).
*   **Kiểm tra độ khớp**: Thống kê tỷ lệ phần trăm khớp chính xác giữa Script người dùng và âm thanh Whisper nhận diện được. Đưa ra cảnh báo đỏ nếu tỷ lệ khớp dưới 90%.

---

## 5. XUẤT VIDEO DỌC 9:16 (TIKTOK/REELS EXPORTER)
Tính năng v1.8 hỗ trợ tối ưu việc tạo video ngắn dọc 9:16 thông qua hai luồng sử dụng chuyên biệt:

### 5.1. Luồng A: Chuyển đổi video ngang có sẵn (Standalone Converter)
Cho phép chuyển đổi một tệp video MP4 nằm ngoài dự án thành tệp dọc 9:16 nhanh chóng mà không cần tạo project storyboard. Người dùng chọn video, nạp tiêu đề, tải lên tệp SRT tùy chọn và xuất tệp đầu ra.

### 5.2. Luồng B: Xuất thêm bản dọc song song với dự án Storyboard
Tích hợp trực tiếp trong tab Export Settings của dự án. Khi được kích hoạt, hệ thống sẽ thực hiện render video gốc (bản ngang 16:9), sau đó tận dụng trực tiếp video này làm nguồn đầu vào để chạy pass FFmpeg thứ hai convert sang bản dọc 9:16 mà không phải dựng lại từ các ảnh storyboard, tiết kiệm 90% thời gian render.

### 5.3. Quy tắc bố cục dọc & Tuỳ chỉnh giao diện chữ
*   **Bố cục 3 vùng**:
    *   **Vùng Tiêu đề (Top 15% - Cao 288px)**: Hiển thị tiêu đề tĩnh xuyên suốt video.
    *   **Vùng Video (Center)**: Video ngang gốc được scale fit chiều ngang, căn giữa. Tự động giới hạn chiều cao video tối đa 70% canvas đối với các video vuông/gần vuông để tránh che khuất chữ.
    *   **Vùng Phụ đề (Bottom 15% - Cao 288px)**: Hiển thị phụ đề chạy đồng bộ.
    *   **Lớp nền (Background)**: Video ngang gốc được co giãn phủ kín canvas (cover-fit), áp bộ lọc gblur/boxblur mạnh và phủ một lớp mặt nạ tối 30% tăng tương phản chữ.
*   **Tùy chỉnh Văn bản dọc**:
    *   **Cỡ chữ (Font Size)**: Thanh trượt tinh chỉnh cỡ chữ tiêu đề và phụ đề linh hoạt từ 24px đến 80px.
    *   **Màu sắc (Text Color)**: Bộ chọn bảng màu nhanh cùng bảng màu HTML5 tự chọn màu bất kỳ cho chữ.
    *   **Vị trí dọc**: Slider chỉnh vị trí Y tiêu đề (cách mép trên 5% - 40%) và MarginV phụ đề (cách mép dưới 50px - 450px).
*   **Live Layout Preview (Mockup điện thoại)**:
    *   Hiển thị một khung mô phỏng điện thoại 9:16 thời gian thực.
    *   Áp dụng CSS absolute positioning mô phỏng chính xác tuyệt đối màu sắc, kích cỡ tỷ lệ co giãn (`fontSize = Size * 340 / 1920`) và vị trí di chuyển của Tiêu đề và Phụ đề theo đúng thông số người dùng cài đặt.
*   **Xác thực tệp SRT (SRT Validator)**:
    *   Quét cấu trúc tệp phụ đề SRT rời ngay khi tải lên. Báo xanh nếu hợp lệ, báo đỏ kèm mô tả chi tiết danh sách dòng bị lỗi định dạng mốc thời gian hoặc sai số thứ tự để tránh lỗi FFmpeg lúc render.

---

## 6. CHIA TÁCH VIDEO DỌC THÀNH NHIỀU VIDEO NGẮN (v1.9)
### 6.1. Nguyên tắc chia tách & Quy tắc chồng lấn (Overlap)
*   **Mốc phân tách**: Người dùng nhập danh sách các mốc chia thời gian trên timeline (ví dụ: `02:00`, `03:00`). Các mốc này được tự động sắp xếp tăng dần và loại bỏ trùng lặp.
*   **Khoảng chồng lấn (Overlap)**: Cấu hình từ 0 đến 30 giây (mặc định là 5 giây). Khoảng overlap giúp người xem theo dõi liền mạch nội dung giữa các phân đoạn ngắn.
*   **Clamp mốc bắt đầu**: Khi overlap đẩy mốc bắt đầu của phân đoạn trước mốc `00:00` của video, mốc bắt đầu của phân đoạn đó được clamp về đúng `00:00`.
*   **Tên tệp đầu ra**: Được đánh số thứ tự từ 1 theo dạng: `{stem}_vertical_{index}.mp4`.
*   **Tiêu đề phân đoạn**: Tự động đánh số theo dạng: `{title} ({index})`. Nếu không nhập tiêu đề, lớp tiêu đề sẽ không được vẽ.

### 6.2. Cắt và Dịch mốc Phụ đề (SRT Slicing & Rebase)
*   Với mỗi phân đoạn `[S, E]` (Start và End), hệ thống trích lọc các câu phụ đề (cues) có mốc thời gian giao nhau: `cueEnd > S && cueStart < E`.
*   Các câu phụ đề được dịch chuyển mốc thời gian (rebase) về mốc zero tương ứng của phân đoạn mới:
    *   `newStart = max(cueStart, S) - S`
    *   `newEnd = min(cueEnd, E) - S`
*   Số thứ tự của các câu phụ đề được đánh lại bắt đầu từ 1.
*   Hệ thống tự động tạo file phụ đề `.ass` tạm thời cho từng phân đoạn để burn-in vào video và tự động xóa sau khi render xong.

### 6.3. Điều phối tuần tự & Hủy bỏ (Sequential Batch & Cancel)
*   **Xử lý tuần tự**: Tiến trình render các phân đoạn video ngắn được thực thi tuần tự (sequential) thay vì chạy song song để giới hạn tải trọng CPU và dung lượng RAM của hệ thống, tránh làm treo ứng dụng.
*   **Mã hóa âm thanh**: Khi thực thi chia tách, luồng âm thanh sẽ được mã hóa lại (re-encode) sang codec `aac` (192kbps) thay vì sao chép thô (`copy`) để đảm bảo chính xác các mốc biên cắt, tránh lệch tiếng hoặc mất tiếng tại các điểm keyframe.
*   **Tính toán tiến độ tổng hợp**: Tiến độ tổng hợp được hiển thị trên thanh tiến độ theo trọng số độ dài từng phân đoạn:
    $$\text{Progress}_{\text{overall}} = \frac{\text{duration}_{\text{đã hoàn thành}} + \text{progress}_{\text{đoạn hiện tại}} \times \text{duration}_{\text{đoạn hiện tại}}}{\text{Tổng duration tất cả phân đoạn}}$$
*   **Thông báo tiến trình**: Giao diện hiển thị thêm chỉ số phân đoạn hiện tại dạng `Đang tạo đoạn n/N`.
*   **Hủy bỏ tiến trình**: Khi người dùng bấm **Hủy** (Cancel) giữa chừng: Tiến trình sẽ dừng ngay lập tức, tệp dở dang của phân đoạn hiện tại bị xóa sạch, các phân đoạn đã xuất thành công trước đó vẫn được bảo toàn để người dùng sử dụng được ngay.


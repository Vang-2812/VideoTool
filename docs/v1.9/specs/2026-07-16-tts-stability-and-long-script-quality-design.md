# Thiết kế ổn định giọng TTS và nâng chất lượng script dài

**Ngày:** 2026-07-16  
**Trạng thái:** Đã triển khai; 38 unit/integration tests, production build và Windows installer/portable đã đạt. Nghiệm thu audio Google Cloud thực tế đang chờ credentials và quota của người dùng.  
**Phạm vi:** Màn hình TTS và pipeline Google Cloud Text-to-Speech của ứng dụng desktop

## 1. Mục tiêu

Giải quyết hai vấn đề hiện tại:

1. Cùng một cấu hình nhưng chất giọng có thể thay đổi giữa các lần tạo audio.
2. Script dài bị chia thành nhiều đoạn nhỏ, làm chất giọng thiếu nhất quán và file audio cuối có thể bị méo hoặc giảm chất lượng.

Tiêu chí ổn định là ổn định về cảm nhận: cùng voice identity, giới tính, âm sắc và tốc độ. Output không bắt buộc giống hệt từng byte giữa các lần chạy.

## 2. Nguyên nhân hiện tại

### 2.1. Biến thiên của model Gemini

`gemini-3.1-flash-tts-preview` là model TTS có tính sinh tạo. Các request độc lập có thể tạo khác biệt về cách thể hiện và thậm chí về đặc trưng người nói. Vì pipeline hiện tại gửi mỗi chunk bằng một request riêng, khác biệt này xuất hiện cả giữa các lần chạy ngắn và giữa các đoạn trong cùng một script dài.

### 2.2. Chia đoạn quá nhỏ

Chunker hiện tại giới hạn khoảng 500 byte và tiếp tục giảm theo kích thước prompt. Một script dài vì vậy tạo ra rất nhiều request độc lập. Với câu dài, thuật toán còn có thể cắt cứng theo số ký tự thay vì biên từ, làm giảm độ tự nhiên.

### 2.3. Đọc sai định dạng LINEAR16

Google Cloud TTS trả `LINEAR16` kèm WAV header. Pipeline hiện tại đưa toàn bộ buffer này vào FFmpeg như raw `s16le`, khiến header có thể bị diễn giải thành sample âm thanh. Khi nhiều đoạn được ghép, lỗi có thể tạo click/noise ở biên và tích lũy thành output méo.

### 2.4. Crossfade không phù hợp với lời nói

Các đoạn hiện được ghép bằng `acrossfade` 150 ms. Việc chồng hai đoạn giọng nói có thể làm âm tiết ở biên bị nhòe hoặc méo. Crossfade phù hợp hơn với nhạc so với nối lời nói đã có khoảng nghỉ tự nhiên.

## 3. Quyết định sản phẩm

### 3.1. Hai chế độ TTS

Ứng dụng có hai chế độ:

- **Stable**, được chọn mặc định.
- **Expressive/Experimental**, giữ các Gemini TTS model hiện có.

### 3.2. Cấu hình mặc định của Stable

- Ngôn ngữ mặc định: `en-US`.
- Model/voice mặc định: `en-US-Chirp3-HD-Charon`.
- Speaking rate mặc định: `1.0`.
- Phương thức chính: Chirp 3 HD bidirectional streaming.
- Fallback thứ nhất: Chirp 3 HD synchronous REST.
- Fallback thứ hai: Neural2 cùng locale; với `en-US` dùng `en-US-Neural2-D`.

### 3.3. Cấu hình của Expressive/Experimental

- Giữ các Gemini model hiện tại.
- Model mặc định trong chế độ này: `gemini-3.1-flash-tts-preview`.
- Giữ voice, prompt, language và speaking rate hiện có.
- Hiển thị cảnh báo rằng voice có thể thay đổi nhẹ giữa các lần hoặc phân đoạn.

### 3.4. Quy tắc không trộn giọng

Một output hoàn chỉnh chỉ được sử dụng một engine, một model và một voice. Khi fallback xảy ra, ứng dụng xóa kết quả tạm và tạo lại toàn bộ script. Không ghép phần Chirp với phần Neural2 hoặc phần từ hai voice khác nhau.

## 4. Phạm vi

### Trong phạm vi

- Thay đổi model mặc định của màn hình TTS sang Stable/Chirp 3 HD.
- Thêm chế độ Expressive/Experimental cho Gemini.
- Thêm Chirp 3 HD streaming bằng thư viện Google Cloud chính thức.
- Giữ REST hiện tại làm fallback.
- Thêm Neural2 fallback.
- Sửa chunker theo giới hạn từng provider.
- Sửa xử lý WAV/PCM và ghép audio cho riêng pipeline TTS.
- Thêm cấu hình credentials JSON, progress, cancel, retry và fallback.
- Kiểm thử unit, integration và nghiệm thu audio.

### Ngoài phạm vi

- Đảm bảo output giống hệt từng byte giữa các lần chạy.
- Google Long Audio Synthesis qua Cloud Storage.
- Voice cloning hoặc custom voice.
- Nhà cung cấp TTS ngoài Google.
- Thay đổi pipeline ghép audio của chức năng không liên quan đến TTS.

## 5. Kiến trúc tổng thể

### 5.1. Renderer

`TtsScreen` chịu trách nhiệm:

- Thu thập script và cấu hình người dùng.
- Hiển thị chế độ, model, voice, speaking rate và output format.
- Gửi toàn bộ job xuống Main process trong một lần thay vì tự lặp qua từng chunk.
- Hiển thị progress, engine thực tế, retry, fallback, thành công và lỗi.
- Gửi lệnh cancel nhưng không trực tiếp đọc credentials.

Renderer không còn chịu trách nhiệm điều phối chunk hoặc ghép file audio.

### 5.2. Main process

Main process chứa một TTS job orchestrator và ba adapter:

1. `ChirpStreamingAdapter`
2. `GoogleRestAdapter`, dùng cho Chirp synchronous, Neural2 và Gemini experimental
3. `TtsAudioAssembler`

Orchestrator chịu trách nhiệm:

- Chọn adapter theo mode và tình trạng credentials.
- Retry và fallback theo state machine.
- Bảo đảm không trộn engine/voice.
- Quản lý temp directory theo job.
- Phát progress event.
- Hủy RPC/FFmpeg và cleanup.
- Trả về model/voice/engine thực tế đã tạo output.

### 5.3. IPC

Giữ API `synthesizeSpeech` hiện tại ở preload để hạn chế ảnh hưởng tới renderer, nhưng chuyển payload từ một chunk thành một job đầy đủ. Main process nhận toàn bộ script và tự xử lý streaming/chunking/fallback.

Payload logic:

```ts
type TtsMode = 'stable' | 'expressive';

interface TtsJobRequest {
  mode: TtsMode;
  text: string;
  languageCode: string;
  voiceName: string;
  modelName?: string;
  prompt?: string;
  speakingRate: number;
  outputPath: string;
  outputFormat: 'wav' | 'mp3';
}
```

Kết quả logic:

```ts
interface TtsJobResult {
  success: boolean;
  outputPath?: string;
  engine?: 'chirp-streaming' | 'chirp-rest' | 'neural2-rest' | 'gemini-rest';
  modelName?: string;
  voiceName?: string;
  fallbackReason?: string;
  error?: string;
}
```

Progress event:

```ts
interface TtsJobProgress {
  phase: 'validating' | 'streaming' | 'synthesizing' | 'retrying' | 'fallback' | 'encoding';
  progress: number;
  engine: string;
  message?: string;
}
```

Thêm API chọn và kiểm tra credentials:

- `select-google-credentials-file`
- `validate-google-tts-credentials`

## 6. Xác thực Google Cloud

Chirp bidirectional streaming dùng `@google-cloud/text-to-speech` và Application Default Credentials.

Settings bổ sung mục **Google Cloud credentials JSON**:

- User chọn file service-account JSON qua file dialog.
- Ứng dụng chỉ lưu đường dẫn, không sao chép nội dung JSON vào project hoặc settings.
- Nội dung file chỉ được đọc trong Main process.
- Renderer chỉ nhận trạng thái `valid`, `invalid` hoặc `not-configured`.
- Thông báo lỗi phải loại bỏ token, private key và nội dung JSON.
- Không yêu cầu user cài `gcloud`.

Nếu credentials chưa có hoặc không hợp lệ, Stable mode bắt đầu bằng Chirp REST sử dụng cấu hình API hiện tại. Streaming không phải điều kiện bắt buộc để dùng Stable mode.

## 7. Chế độ Stable

### 7.1. Luồng streaming

1. Validate input, output path và credentials.
2. Tạo đúng một streaming config với language, voice và speaking rate.
3. Gửi các đoạn văn bản ngữ nghĩa trong cùng một streaming session.
4. Nhận PCM theo thứ tự và ghi vào buffer/file tạm theo cơ chế backpressure.
5. Sau khi stream hoàn tất, đóng gói PCM thành WAV mono 24 kHz.
6. Xuất WAV trực tiếp hoặc encode MP3 đúng một lần.

Streaming chỉ tương thích với Chirp 3 HD. Một session dùng một cấu hình voice cố định cho toàn bộ script.

### 7.2. Luồng Chirp REST

REST được dùng khi:

- Không có credentials streaming.
- Credentials không hợp lệ.
- Streaming thất bại sau retry cho phép.

Văn bản được chia thành các request lớn theo biên ngữ nghĩa. Mọi request dùng cùng language, voice và speaking rate. Audio của từng request được lưu thành WAV hợp lệ trước khi ghép lossless.

### 7.3. Neural2 fallback

Neural2 chỉ chạy khi Chirp REST không khả dụng do lỗi model/dịch vụ sau retry. Toàn bộ kết quả Chirp tạm bị xóa trước khi bắt đầu Neural2.

Fallback resolver chọn Neural2 cùng locale và ưu tiên voice có giới tính tương ứng với Chirp đã chọn. Với cấu hình mặc định `en-US-Chirp3-HD-Charon`, fallback cố định là `en-US-Neural2-D`. Nếu locale không có Neural2 tương ứng, job kết thúc với lỗi rõ ràng thay vì âm thầm đổi ngôn ngữ.

## 8. Chế độ Expressive/Experimental

Gemini tiếp tục sử dụng REST và prompt biểu cảm. Chế độ này không cam kết ổn định voice như Stable.

Các cải tiến audio/chunking vẫn áp dụng:

- Chunk lớn hơn.
- Không cắt giữa từ.
- Không diễn giải WAV header thành PCM.
- Không crossfade lời nói.
- Chỉ encode output một lần.

Nếu một Gemini chunk lỗi, retry chỉ dùng cùng model và voice. Chế độ này không tự động fallback sang Chirp hoặc Neural2 vì điều đó sẽ thay đổi mục đích biểu cảm mà user đã chọn.

## 9. Chunking

### 9.1. Quy tắc chung

Trước khi chia đoạn:

- Chuẩn hóa line ending và khoảng trắng thừa.
- Giữ dấu câu, xuống đoạn và nội dung Unicode.
- Không thay đổi từ hoặc tự chèn nội dung mới.

Thứ tự biên chia:

1. Đoạn văn.
2. Câu bằng `Intl.Segmenter`.
3. Mệnh đề tại dấu phẩy, chấm phẩy hoặc dấu gạch phù hợp.
4. Khoảng trắng.

Không bao giờ cắt giữa code point, surrogate pair hoặc giữa từ. Một token đơn lẻ vượt giới hạn phải tạo lỗi validation rõ ràng.

### 9.2. Giới hạn theo provider

- Chirp streaming: gửi các đoạn ngữ nghĩa nhỏ trong cùng session; mỗi message luôn thấp hơn giới hạn dịch vụ.
- Chirp REST và Neural2: tối đa 4.500 byte text mỗi request, chừa headroom dưới giới hạn Cloud TTS 5.000 byte.
- Gemini Experimental: tối đa khoảng 3.500 byte text. Text và prompt đều được kiểm tra riêng dưới giới hạn 4.000 byte, đồng thời tổng không vượt 8.000 byte.

Byte length được tính bằng UTF-8, không dùng `string.length`.

## 10. Audio pipeline

### 10.1. Streaming PCM

Streaming adapter chủ động yêu cầu định dạng PCM không header. Các `audio_content` được nối theo thứ tự vào một luồng PCM mono 24 kHz, 16-bit. WAV header chỉ được tạo một lần sau khi hoàn tất.

Không giữ toàn bộ audio dài trong RAM nếu có thể tránh; writer dùng file tạm và backpressure.

### 10.2. REST LINEAR16

Với REST, response `LINEAR16` được coi là WAV có header:

- Ghi nguyên buffer thành `.wav`.
- Để FFmpeg hoặc WAV parser đọc container.
- Không truyền cả buffer vào input raw `s16le`.

Nếu cần lấy PCM để ghép, header được parse và loại bỏ bằng WAV parser có validation, không cắt theo offset hard-code.

### 10.3. Ghép và encode

- Mọi đoạn được chuẩn hóa về mono PCM 24 kHz, 16-bit.
- Ghép tuần tự ở biên sample.
- Không dùng `acrossfade`.
- Không chèn khoảng lặng cố định giữa các đoạn; giữ khoảng nghỉ TTS tạo từ dấu câu/script.
- WAV output được đóng gói lossless một lần.
- MP3 output được encode từ PCM/WAV tổng hợp đúng một lần.

Thay đổi này chỉ áp dụng cho pipeline TTS. Không thay đổi hành vi của `concat-audio-only` cho các tính năng khác nếu chúng vẫn cần crossfade.

## 11. UI và migration

### 11.1. Stable

- Tab/segmented control `Stable` được chọn mặc định.
- Model hiển thị là Chirp 3 HD.
- Language mặc định `en-US`.
- Voice mặc định `Charon`.
- Voice selector chỉ hiển thị Chirp 3 HD voice của locale đang chọn.
- Speaking rate từ `0.25` đến `2.0`, mặc định `1.0`.
- Ẩn prompt biểu cảm.
- Hiển thị `Streaming` khi credentials valid, ngược lại hiển thị `REST`.

### 11.2. Expressive/Experimental

- Hiển thị Gemini model selector, prompt, voice, language và speaking rate hiện có.
- Hiển thị nhãn Experimental và cảnh báo về voice variability.

### 11.3. Progress và kết quả

Trong job, UI hiển thị engine thực tế:

- `Chirp Streaming`
- `Chirp REST`
- `Neural2 Fallback`
- `Gemini Experimental`

Khi fallback, progress reset về đầu và UI ghi lý do ngắn gọn. Sau khi hoàn tất, UI hiển thị output path, engine, model và voice thực tế.

### 11.4. Migration

Thêm setting `ttsMode`. Nếu settings cũ chưa có field này, giá trị mặc định là `stable`. Các giá trị Gemini cũ vẫn được giữ để sử dụng khi user chuyển sang Expressive/Experimental.

## 12. Retry, fallback và cancel

### 12.1. Streaming

- Lỗi credentials/configuration: chuyển ngay sang Chirp REST.
- Lỗi mạng giữa stream: xóa audio tạm và thử lại toàn bộ streaming một lần.
- Lỗi lần hai: xóa audio tạm và chạy lại toàn bộ bằng Chirp REST.

### 12.2. REST

- Retry tối đa 3 lần cho timeout, lỗi mạng, HTTP 429 và lỗi server có thể phục hồi.
- Dùng exponential backoff có jitter và tôn trọng `Retry-After` nếu có.
- Không retry lỗi validation hoặc credential bằng cùng request không thay đổi.
- Chirp lỗi model/dịch vụ sau retry: xóa toàn bộ Chirp output tạm và chạy Neural2 từ đầu.

### 12.3. Cancel

Cancel phải:

1. Đặt job vào trạng thái cancelling.
2. Abort RPC/HTTP đang chạy.
3. Dừng FFmpeg nếu đang encode.
4. Không bắt đầu retry hoặc fallback mới.
5. Xóa file output dở và temp directory.
6. Trả trạng thái cancelled cho UI.

## 13. Xử lý lỗi

- Script rỗng: không bắt đầu job.
- Voice không khớp locale/model: validation error trước khi gọi API.
- Credentials JSON không đọc được: đánh dấu invalid và dùng REST nếu API key hợp lệ.
- API key không hợp lệ: hiển thị lỗi xác thực đã redact.
- Không tạo được thư mục/file output: dừng trước khi gọi TTS.
- PCM/WAV sai sample rate, channel hoặc bit depth: không ghép; báo lỗi audio validation.
- Streaming, Chirp REST và Neural2 đều lỗi: không tạo output cuối và hiển thị chuỗi fallback đã thử.
- Mọi đường lỗi và cancel đều cleanup trong `finally`.

## 14. Kiểm thử

### 14.1. Unit tests

- Chunker không vượt giới hạn byte theo provider.
- UTF-8 byte length đúng với ký tự nhiều byte.
- Không cắt giữa từ, surrogate pair hoặc code point.
- Giữ thứ tự câu, dấu câu và xuống đoạn.
- Xử lý câu đơn rất dài và token vượt giới hạn.
- Fallback state machine chạy đúng `streaming -> Chirp REST -> Neural2`.
- Không ghép artifact từ engine trước sau fallback.
- Progress reset đúng khi fallback.
- Retry phân biệt lỗi transient và permanent.
- WAV parser nhận đúng header và từ chối file lỗi.
- PCM writer tạo WAV mono 24 kHz, 16-bit hợp lệ.
- Migration settings cũ đặt `ttsMode = stable` và giữ cấu hình Gemini cũ.
- Credential API không trả private key cho renderer.

### 14.2. Integration tests

- Mock streaming trả nhiều audio response theo đúng thứ tự.
- Streaming lỗi giữa chừng xóa artifact và restart/fallback toàn bộ.
- Chirp REST lỗi kích hoạt Neural2 toàn bộ.
- Cancel dừng request, FFmpeg và cleanup.
- REST WAV không bị đưa vào FFmpeg dưới dạng raw PCM có header.
- WAV output chỉ có một RIFF header.
- MP3 chỉ qua một bước encode cuối.
- TTS pipeline không gọi `acrossfade`.
- Build TypeScript/Vite và Electron thành công.

### 14.3. Nghiệm thu thủ công

- Tạo cùng một đoạn `en-US`, cùng setting ít nhất 5 lần; voice identity, giới tính, âm sắc và tốc độ ổn định về cảm nhận.
- Tạo script tiếng Anh dài nhiều đoạn; không có click, chồng âm tiết, méo tiếng hoặc giảm chất lượng ở cuối.
- Cố ý ngắt streaming giữa job; output cuối hoàn toàn từ Chirp REST.
- Cố ý làm Chirp lỗi; output cuối hoàn toàn từ Neural2.
- Kiểm tra WAV và MP3 bằng nghe trực tiếp và `ffprobe`.
- Xác nhận Expressive/Experimental vẫn tạo được Gemini audio và hiển thị cảnh báo.

## 15. Tiêu chí hoàn thành

- Stable là chế độ mặc định sau migration.
- Default voice là `en-US-Chirp3-HD-Charon`.
- Streaming hoạt động khi credentials hợp lệ; REST hoạt động khi không có credentials.
- Fallback không tạo output trộn model hoặc voice.
- Script dài không còn bị chia ở ngưỡng 500 byte hoặc giữa từ.
- Pipeline không còn diễn giải WAV header như raw PCM.
- TTS output không dùng crossfade và MP3 chỉ encode một lần.
- UI hiển thị engine/model/voice thực tế và lý do fallback.
- Cancel và mọi đường lỗi đều cleanup artifact tạm.
- Bộ test liên quan và build đều thành công.

## 16. Tài liệu tham khảo chính thức

- Chirp 3 HD: https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd
- Bidirectional streaming: https://docs.cloud.google.com/text-to-speech/docs/create-audio-text-streaming
- Authentication: https://docs.cloud.google.com/text-to-speech/docs/authentication
- Cloud TTS quotas: https://docs.cloud.google.com/text-to-speech/quotas
- AudioEncoding: https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/AudioEncoding
- Gemini TTS: https://docs.cloud.google.com/text-to-speech/docs/gemini-tts

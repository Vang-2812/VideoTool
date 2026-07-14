# Thiết kế tách video dọc thành nhiều đoạn ngắn

**Ngày:** 2026-07-13  
**Trạng thái:** Đã được người dùng duyệt trong phiên brainstorming  
**Phạm vi:** Converter video dọc độc lập và xuất video dọc trong một project Storyboard

## 1. Mục tiêu

Bổ sung một chế độ tùy chọn cho chức năng tạo video dọc 9:16. Khi bật chế độ này, người dùng nhập các mốc chia trên timeline của video ngang nguồn và ứng dụng tạo nhiều video dọc ngắn thay vì một video dọc duy nhất.

Ví dụ video dài 5 phút, mốc chia `02:00` và `03:00`, overlap 5 giây:

1. `00:00 -> 02:00`
2. `01:55 -> 03:00`
3. `02:55 -> 05:00`

Mỗi video có title được thêm số thứ tự, ví dụ `Title (1)`, `Title (2)`, `Title (3)`, và tên file lần lượt là `video_vertical_1.mp4`, `video_vertical_2.mp4`, `video_vertical_3.mp4`.

## 2. Phạm vi

### Trong phạm vi

- Màn hình chuyển đổi video dọc độc lập `VerticalConvertScreen`.
- Luồng xuất video dọc kèm theo một project Storyboard.
- Cấu hình danh sách mốc chia và khoảng overlap.
- Lưu và mở lại cấu hình split trong `.sbvproj`.
- Cắt và rebase phụ đề SRT theo từng đoạn.
- Tiến độ tổng, hủy batch và báo lỗi từng đoạn.

### Ngoài phạm vi

- Batch render nhiều project.
- Tự động đề xuất mốc chia bằng AI hoặc nội dung SRT.
- Render nhiều đoạn song song.
- Thay đổi bố cục, preset chất lượng hoặc style title/phụ đề hiện có.

## 3. Quyết định sản phẩm

- Chế độ split mặc định tắt.
- Người dùng nhập từng mốc bằng một danh sách có nút thêm và xóa.
- Chấp nhận định dạng `MM:SS` và `HH:MM:SS`.
- Overlap cấu hình bằng số giây nguyên từ 0 đến 30, mặc định 5.
- Mốc chia được tự động sắp xếp tăng dần sau khi parse.
- Khi overlap đẩy điểm bắt đầu trước `00:00`, điểm bắt đầu được clamp về `00:00`.
- Converter độc lập yêu cầu chọn một thư mục đầu ra khi split được bật.
- Luồng project ghi các đoạn vào cùng thư mục với video ngang đầu ra.
- Khi split tắt, hành vi hiện tại được giữ nguyên và vẫn tạo một file `_vertical.mp4`.

## 4. Kiến trúc

### 4.1. Thành phần UI

`VerticalConvertScreen` giữ state cục bộ cho converter độc lập:

- `splitEnabled: boolean`
- `splitPointInputs: string[]`
- `overlapSeconds: number`
- Duration của video nguồn và kết quả validation.

Duration standalone được nạp qua `get-video-duration` sau khi chọn video. Trong project, preview dùng `totalDuration`; khi video ngang render xong, Main process dùng duration thực tế của file đầu ra để validate lại trước khi tạo các đoạn dọc.

`SettingsScreen` sử dụng state trong `ProjectContext` cho luồng project:

- Bật/tắt split.
- Danh sách mốc chia.
- Overlap.
- Preview danh sách đoạn và lỗi validation.

### 4.2. Segment planner

Một module logic thuần chịu trách nhiệm:

1. Parse chuỗi thời gian thành số giây.
2. Validate mốc dựa trên duration video.
3. Loại bỏ trường hợp trùng và sắp xếp mốc tăng dần.
4. Tạo danh sách segment `{ index, startTime, endTime, duration }`.
5. Sinh title và tên file dự kiến.

Module này không gọi Electron, filesystem hoặc FFmpeg để có thể kiểm thử độc lập.

### 4.3. Batch converter

Bổ sung một lớp điều phối dùng chung cho converter độc lập và project:

1. Đọc duration video nguồn.
2. Validate cấu hình split lần cuối ở Main process.
3. Tạo danh sách segment bằng segment planner.
4. Chạy tuần tự từng segment.
5. Tạo SRT/ASS tạm riêng cho segment nếu có phụ đề.
6. Gọi primitive render một đoạn.
7. Tổng hợp tiến độ và kết quả output.

`convertToVertical()` tiếp tục là primitive render một video. Hàm được mở rộng với `startTime` và `duration`; nếu không truyền hai giá trị này, hàm giữ hành vi render toàn bộ video như hiện tại.

### 4.4. IPC và kiểu dữ liệu

IPC `convert-to-vertical` hiện tại tiếp tục được sử dụng. Params được mở rộng bằng cấu hình tùy chọn:

```ts
interface VerticalSplitConfig {
  enabled: boolean;
  splitPoints: number[];
  overlapSeconds: number;
  outputDirectory?: string;
  outputBaseName?: string;
}
```

Kết quả batch:

```ts
interface VerticalBatchResult {
  success: boolean;
  outputPaths: string[];
  completedSegments: number;
  totalSegments: number;
  error?: string;
}
```

Event tiến độ được mở rộng, giữ tương thích với `progress` và `eta` hiện có:

```ts
interface VerticalProgress {
  progress: number;
  eta: string;
  segmentIndex?: number;
  segmentCount?: number;
}
```

Bổ sung một API hẹp cho UI và tái sử dụng API chọn thư mục sẵn có:

- `get-video-duration`: dùng ffprobe để trả duration của video standalone ngay sau khi chọn file. Main process vẫn đọc lại duration lúc bắt đầu batch để validation bằng dữ liệu hiện hành.
- `select-export-directory`: API hiện có chỉ mở dialog chọn thư mục và trả về đường dẫn; converter standalone tái sử dụng API này. Không dùng `select-directory` vì channel đó còn parse thư mục storyboard.

## 5. Cấu trúc dữ liệu project

Thêm các field sau vào `ProjectData` và `ProjectContext`:

```ts
vertical_split_enabled?: boolean;
vertical_split_points?: number[];
vertical_overlap_seconds?: number;
```

Giá trị mặc định khi mở project cũ:

- `vertical_split_enabled = false`
- `vertical_split_points = []`
- `vertical_overlap_seconds = 5`

Các mốc được lưu dưới dạng giây đã parse và sắp xếp, không lưu chuỗi hiển thị.

## 6. Giao diện và validation

Khi bật split, giao diện hiển thị:

- Danh sách ô nhập mốc thời gian.
- Nút `Thêm mốc`.
- Nút xóa cho từng dòng.
- Input overlap từ 0 đến 30 giây.
- Preview các khoảng đầu ra, title và tên file.
- Lỗi trực tiếp tại dòng mốc không hợp lệ.

Một mốc hợp lệ phải:

- Đúng định dạng `MM:SS` hoặc `HH:MM:SS`.
- Có phần giây từ 00 đến 59.
- Với `HH:MM:SS`, phần phút từ 00 đến 59.
- Lớn hơn 0.
- Nhỏ hơn duration video.
- Không trùng một mốc khác sau khi parse.

Nút xuất bị vô hiệu hóa nếu split bật mà:

- Chưa có mốc chia.
- Có bất kỳ mốc không hợp lệ.
- Duration video chưa đọc được.
- Overlap không phải số nguyên trong khoảng 0 đến 30.

Main process thực hiện lại cùng validation; UI validation không được xem là ranh giới tin cậy.

## 7. Quy tắc tạo segment

Với duration `D`, các mốc đã sắp xếp `P1...Pn` và overlap `O`:

- Segment 1: `start = 0`, `end = P1`.
- Segment i, với `i > 1`: `start = max(0, P(i-1) - O)`, `end = Pi`.
- Segment cuối: `start = max(0, Pn - O)`, `end = D`.

Mọi segment phải có `end > start`. Nếu điều kiện này không thỏa mãn, batch bị từ chối trước khi FFmpeg chạy.

## 8. Quy tắc title và tên file

Nếu title có nội dung, segment thứ `n` dùng title `${title} (${n})`. Nếu title rỗng, không tạo lớp title; số thứ tự chỉ xuất hiện trong tên file.

Tên file dựa trên basename video đầu ra:

- Converter độc lập với source `video.mp4`: `video_vertical_1.mp4`, `video_vertical_2.mp4`, ...
- Project với output ngang `project.mp4`: `project_vertical_1.mp4`, `project_vertical_2.mp4`, ...

Khi split tắt, quy tắc hiện tại được giữ nguyên: `video_vertical.mp4` hoặc `project_vertical.mp4`.

## 9. Xử lý SRT theo segment

Với segment `[S, E]`, một cue `[cueStart, cueEnd]` được giữ nếu hai khoảng có giao nhau:

```text
cueEnd > S && cueStart < E
```

Timestamp mới:

```text
newStart = max(cueStart, S) - S
newEnd   = min(cueEnd, E) - S
```

Cue chạy xuyên qua biên segment được clamp tại biên. Cue không có duration dương sau khi clamp bị bỏ qua. Thứ tự cue được giữ nguyên và được đánh số lại từ 1.

Mỗi segment tạo một file subtitle tạm riêng, chuyển sang ASS bằng style dọc hiện có, burn vào video rồi xóa trong `finally`.

## 10. FFmpeg và chất lượng đầu ra

Mỗi segment được render trực tiếp từ video ngang nguồn, không tạo clip ngang trung gian và không render video dọc đầy đủ trước.

Primitive render nhận:

- `startTime`
- `duration`
- Title đã thêm số thứ tự.
- File subtitle tạm đã rebase.
- Các thiết lập dọc hiện có.

Video tiếp tục encode `libx264` theo preset/bitrate hiện tại. Trong split mode, audio encode AAC thay vì stream copy để bảo đảm cắt chính xác và tránh lệch tiếng tại vị trí không phải keyframe. Luồng không split giữ hành vi audio hiện tại.

Batch chạy tuần tự để giới hạn CPU và RAM. Tổng thời gian encode bằng tổng duration các segment, bao gồm phần overlap.

## 11. Tiến độ và hủy

Tiến độ tổng được tính theo trọng số duration:

```text
(duration đã hoàn thành + progress hiện tại * duration segment hiện tại)
/ tổng duration của tất cả segment
```

UI hiển thị thêm `Đang tạo đoạn n/N`. ETA sử dụng tốc độ của FFmpeg hiện tại và duration còn lại của toàn batch khi có đủ dữ liệu; nếu chưa tính được thì hiển thị `--:--`.

Khi người dùng hủy:

1. Đặt cờ hủy batch.
2. Kill tiến trình FFmpeg hiện tại.
3. Không bắt đầu segment tiếp theo.
4. Xóa output đang viết dở và file tạm của segment hiện tại.
5. Giữ các segment đã hoàn thành.

## 12. Xử lý lỗi

- Validation thất bại: không chạy FFmpeg và trả lỗi chi tiết.
- Không đọc được duration: dừng trước khi tạo output.
- Không đọc được SRT: dừng batch; không âm thầm bỏ phụ đề trong split mode.
- FFmpeg lỗi ở segment `n`: dừng batch, xóa file dở của segment `n`, giữ các segment hoàn thành trước đó.
- Ghi file trùng tên tiếp tục theo hành vi overwrite hiện tại của FFmpeg.
- Kết quả lỗi trả `outputPaths` của các segment đã hoàn thành để UI có thể mở thư mục kết quả.

## 13. Kiểm thử

### Unit tests

- Parse `MM:SS` và `HH:MM:SS` hợp lệ.
- Từ chối format sai và thành phần thời gian ngoài phạm vi.
- Từ chối mốc 0, ngoài duration và mốc trùng.
- Sắp xếp mốc tăng dần.
- Tạo đúng segment với overlap 0, 5 và 30 giây.
- Clamp điểm bắt đầu segment về 0.
- Cắt, clamp, rebase và đánh số lại cue SRT.
- Sinh đúng title và tên file.
- Tính đúng tiến độ tổng có trọng số.
- Default đúng khi load project cũ.

### Integration và regression

- Build TypeScript/Vite thành công.
- Xuất một video dọc khi split tắt và xác nhận hành vi cũ.
- Xuất ba đoạn với mốc `02:00`, `03:00`, overlap 5.
- Kiểm tra duration, hình, tiếng và phụ đề tại các biên cắt.
- Kiểm tra title `(1)`, `(2)`, `(3)` và tên file.
- Hủy khi đang render segment giữa.
- Gây lỗi segment giữa và xác nhận file dở bị xóa, file hoàn thành được giữ.
- Lưu/mở project có split và mở project cũ không có field split.

## 14. Tiêu chí hoàn thành

- Hai luồng trong phạm vi đều có thể bật split và tạo đúng số video.
- Segment, overlap, title, tên file và SRT tuân thủ các quy tắc trên.
- Người dùng thấy lỗi input trước khi render.
- Progress và cancel hoạt động trên toàn batch.
- Project lưu và phục hồi cấu hình split.
- Luồng không split không bị regression.
- Build và bộ test liên quan đều thành công.

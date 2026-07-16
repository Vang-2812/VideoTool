# HƯỚNG DẪN CẤU HÌNH GOOGLE CLOUD CHO TTS
## OAuth 2.0 cho REST và service account tùy chọn cho Chirp streaming

Để sử dụng chức năng tổng hợp giọng nói từ Google Cloud Text-to-Speech bằng tài khoản của chính bạn, ứng dụng yêu cầu thiết lập xác thực OAuth 2.0. Dưới đây là các bước thao tác chi tiết trên trang quản trị Google Cloud Console.

---

### Bước 1: Tạo dự án mới (Google Cloud Project)
1. Truy cập vào [Google Cloud Console](https://console.cloud.google.com/).
2. Đăng nhập bằng tài khoản Google (Gmail hoặc Google Workspace) của bạn.
3. Ở góc trên cùng bên trái (cạnh logo Google Cloud), nhấn vào danh sách dự án hiện tại và chọn **New Project** (Dự án mới).
4. Nhập **Project Name** (ví dụ: `Storyboard Video Tool`) và bấm **Create**.
5. Chờ vài giây để hệ thống tạo xong, sau đó chọn dự án vừa tạo từ thanh chọn dự án.

---

### Bước 2: Kích hoạt API Google Cloud Text-to-Speech
1. Trên thanh tìm kiếm ở đầu trang Google Cloud Console, gõ tìm từ khóa: **Cloud Text-to-Speech API**.
2. Chọn dịch vụ **Cloud Text-to-Speech API** trong danh sách kết quả.
3. Nhấn nút **Enable** (Kích hoạt) để cho phép dự án sử dụng dịch vụ tổng hợp giọng nói.

> [!NOTE]
> Để API hoạt động, tài khoản Google Cloud của bạn cần liên kết với một tài khoản thanh toán (Billing Account). Google luôn cung cấp gói miễn phí hàng tháng rất lớn đối với dịch vụ TTS (lên tới 4 triệu ký tự Standard hoặc 1 triệu ký tự WaveNet miễn phí mỗi tháng).

---

### Bước 3: Cấu hình Màn hình đồng ý OAuth (OAuth Consent Screen)
Trước khi tạo mã khóa xác thực, Google yêu cầu bạn thiết lập màn hình đồng ý để người dùng xác nhận cấp quyền:
1. Ở thanh menu bên trái, truy cập vào mục **APIs & Services** > **OAuth consent screen**.
2. Chọn **User Type** là **External** (Người dùng bên ngoài) và bấm **Create**.
3. Nhập các thông tin bắt buộc:
   * **App name**: Tên ứng dụng (ví dụ: `Storyboard Video Tool`).
   * **User support email**: Chọn email của bạn.
   * **Developer contact information**: Nhập email của bạn ở mục dưới cùng.
4. Bấm **Save and Continue** để chuyển sang phần Scopes.
5. Tại mục **Scopes** (Phạm vi):
   * Nhấn **Add or Remove Scopes**.
   * Ở ô nhập phạm vi thủ công (hoặc tìm kiếm), thêm phạm vi: `https://www.googleapis.com/auth/cloud-platform`
   * Nhấn **Add to table** và chọn **Update**. Bấm **Save and Continue**.
6. Tại mục **Test Users** (Người dùng thử nghiệm) - **RẤT QUAN TRỌNG**:
   * Vì ứng dụng đang ở trạng thái phát triển (Testing), Google chỉ cho phép những tài khoản được khai báo trước đăng nhập.
   * Nhấn **Add Users**, nhập địa chỉ email (Gmail) của bạn và của những người sẽ chạy thử công cụ này.
   * Bấm **Save and Continue**, kiểm tra lại thông tin tóm tắt và chọn **Back to Dashboard**.

---

### Bước 4: Tạo Client ID và Client Secret (Credentials)
1. Ở thanh menu bên trái, chọn mục **Credentials** (Thông tin xác thực).
2. Nhấn vào nút **Create Credentials** ở đầu trang và chọn **OAuth client ID**.
3. Tại ô **Application type**, chọn **Web application** (Ứng dụng web).
4. **Name**: Nhập tên gợi nhớ (ví dụ: `Storyboard Web Client`).
5. Cuộn xuống phần **Authorized redirect URIs** (Đường dẫn chuyển hướng được ủy quyền):
   * Nhấn nút **Add URI**.
   * Nhập chính xác địa chỉ sau: `http://127.0.0.1:3456/oauth2callback`
   
   > [!IMPORTANT]
   > Bạn phải nhập chính xác từng ký tự đường dẫn trên (dùng `127.0.0.1` thay vì `localhost`, cổng `3456` và đường dẫn `/oauth2callback`) để ứng dụng Electron có thể bắt được token xác thực cục bộ.

6. Nhấn nút **Create**.
7. Một cửa sổ popup xuất hiện hiển thị:
   * **Your Client ID** (Chuỗi dài kết thúc bằng `.apps.googleusercontent.com`)
   * **Your Client Secret** (Chuỗi mật mã bảo mật)
8. Copy hai thông tin này để dán vào phần cài đặt của Storyboard-to-Video Tool.

---

### Bước 5: Nhập khóa vào ứng dụng và đăng nhập
1. Mở ứng dụng **Storyboard-to-Video Tool**.
2. Di chuyển tới mục **Cài đặt (Settings)** > **Google Cloud Config**.
3. Dán **Client ID** và **Client Secret** tương ứng vào ô nhập.
4. Bấm **Đăng nhập Google** (Login Google).
5. Trình duyệt hệ thống sẽ tự động bật lên yêu cầu bạn đăng nhập tài khoản Gmail (phải nằm trong danh sách Test Users đã đăng ký ở Bước 3).
6. Bấm chấp nhận các cảnh báo an toàn (chọn *Advanced* > *Go to Storyboard Video Tool (unsafe)* vì app chưa submit lên Google kiểm duyệt) và đồng ý cấp quyền.
7. Khi trình duyệt hiển thị thông báo đăng nhập thành công, bạn có thể quay lại ứng dụng để sử dụng chức năng TTS giọng đọc AI bình thường.

---

## Bật Chirp 3 HD streaming bằng service account (tùy chọn)

Stable TTS có thể dùng Chirp 3 HD bidirectional streaming để giữ một voice session xuyên suốt script dài. Nếu không cấu hình file này, OAuth REST ở trên vẫn hoạt động và hệ thống tự dùng chuỗi fallback Chirp REST → Neural2.

1. Trong đúng Google Cloud Project đã bật **Cloud Text-to-Speech API**, mở **IAM & Admin** > **Service Accounts**.
2. Chọn **Create service account**, đặt tên dễ nhận biết, ví dụ `video-tool-tts`.
3. Cấp quyền tối thiểu cho project để gọi Cloud Text-to-Speech. Ưu tiên role chuyên biệt cho người dùng Text-to-Speech nếu project của bạn cung cấp; không cấp Owner hoặc Editor chỉ để chạy TTS.
4. Mở service account vừa tạo, chọn **Keys** > **Add key** > **Create new key** > **JSON**, rồi tải file về máy.
5. Trong ứng dụng, mở **Settings** > **Chirp Streaming Credentials** > **Chọn credentials JSON** và chọn file vừa tải.
6. Xác nhận trạng thái hiển thị **Hợp lệ**. Có thể dùng **Kiểm tra lại** sau khi thay đổi quyền hoặc bật API.

> [!IMPORTANT]
> File JSON chứa private key. Không gửi file qua email/chat, không commit vào Git và không đặt trong thư mục đồng bộ công khai. Ứng dụng chỉ lưu đường dẫn; nội dung credential được đọc trong Electron Main process và không được chuyển sang giao diện renderer.

Để tắt streaming, chọn **Xóa cấu hình**. Thao tác này chỉ xóa đường dẫn đã lưu trong ứng dụng, không xóa file JSON gốc và không ảnh hưởng kết nối OAuth REST.

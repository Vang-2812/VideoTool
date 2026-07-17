# Design Specification: Collapsible Sidebar Navigation

## 1. Goal & Requirements
Relocate the main module navigation toolbar from the top Header bar to a responsive, collapsible left Sidebar (`Sidebar.tsx`). The sidebar supports toggling between an Expanded state (showing Logo, Title, and Icon + Text for each module) and a Collapsed state (shrinking to a compact icon-only rail with hover tooltips). The top Header bar is streamlined to display breadcrumbs, project progress stepper, and project action buttons. Sidebar collapse state is persisted in `localStorage`.

---

## 2. Architecture & Layout

```
+-----------------------------------------------------------------------------------+
| [<]  Logo  >  Breadcrumb: Video018           [1] Import -> [2] Preview ...   [Lưu] [Thư viện] |
+-----------+-----------------------------------------------------------------------+
| 🎬 Dự Án  |                                                                       |
| 🎙️ TTS    |                                                                       |
| 🔊 Phụ Đề |                 MAIN APPLICATION CONTENT VIEW (100% Height)            |
| 📱 Dọc    |                                                                       |
| 📹 Reup   |                                                                       |
| ⚙️ Settings|                                                                       |
+-----------+-----------------------------------------------------------------------+
```

### 2.1. Left Sidebar Component (`src/components/Sidebar.tsx`)
- **Expanded Width**: `w-60` (240px).
- **Collapsed Width**: `w-16` (64px).
- **Toggle Control**: Header/Footer toggle button with icon (`PanelLeftClose` / `PanelLeftOpen`).
- **Navigation Module Items**:
  1. `storyboard` -> **Dự Án** (`Film` icon)
  2. `tts` -> **Tạo Giọng Đọc (TTS)** (`Mic` icon)
  3. `aligner` -> **Tạo Phụ Đề** (`Volume2` icon)
  4. `vertical` -> **Convert Dọc 9:16** (`Smartphone` icon)
  5. `reup` -> **Reup Video** (`Video` icon)
  6. `settings` -> **Cài Đặt API** (`Settings` icon)
- **Active Highlight State**: `#8B5CF6` primary background with subtle purple glow and border ring.
- **State Persistence**: Persists `isSidebarCollapsed` in `localStorage.getItem('sidebar_collapsed')`.

### 2.2. Streamlined Top Header (`src/App.tsx`)
- Contains only:
  - **Left**: Logo & Breadcrumb trail (`Storyboard to Video Tool > Project Name`).
  - **Center**: 5-Step Project Progress Tracker (only visible when active module is `storyboard` and editing a project).
  - **Right**: Action buttons (**Lưu**, **Lưu mới**, **Thư viện**).

---

## 3. Verification Plan

### Automated Tests
- Run `npm test` to verify zero regressions across unit test suites.

### Manual Verification
1. Click the toggle button to collapse the sidebar to 64px. Verify text labels hide and tooltips appear on hover.
2. Click module icons in collapsed mode and confirm screen switching works.
3. Reload the application and verify sidebar collapse state is remembered.
4. Verify top header is clean, displaying breadcrumb, stepper, and action buttons properly.

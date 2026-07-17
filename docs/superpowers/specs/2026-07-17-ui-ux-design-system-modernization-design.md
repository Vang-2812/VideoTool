# Design Specification: UI/UX Modernization & Design System Standardization

## 1. Goal & Requirements
Standardize and modernize the user interface across all screens of the application (Dashboard, TTS, Subtitle Aligner, Vertical Converter, API Settings, and Reup Video). Unify component styles (inputs, dropdowns, checkboxes, radio buttons, sliders, color swatches), establish a clear visual hierarchy, optimize layout density to eliminate unnecessary scrolling (especially in API Settings), and enforce a cohesive design system while preserving 100% of existing functionality and business logic.

---

## 2. Design Token System

### 2.1. Color Palette
- **Background Main (`--bg-main`)**: `#0D0F17` (Deep Midnight Dark)
- **Card Surface (`--bg-surface`)**: `#161926` (Sleek Dark Surface)
- **Card Hover (`--bg-hover`)**: `#202436`
- **Border Neutral (`--border-neutral`)**: `#2A2F45`
- **Accent Primary (`--accent-purple`)**: `#8B5CF6` (Neon Purple)
- **Accent Secondary (`--accent-cyan`)**: `#06B6D4` (Cyan)
- **Text Main (`--text-main`)**: `#F3F4F6`
- **Text Muted (`--text-muted`)**: `#9CA3AF`

### 2.2. Typography & Spacing
- **Font Family**: `Inter`, system-ui, sans-serif
- **Scale**:
  - `Heading 1`: 16px / Bold (700)
  - `Card / Section Title`: 13px / SemiBold (600)
  - `Body / Input`: 12px / Medium (500)
  - `Caption / Label`: 11px / SemiBold (600) / UpperCase
- **Spacing Unit**: 4px / 8px system (`gap-3` = 12px, `gap-4` = 16px, `p-4` = 16px).

### 2.3. Control System Styling
- **Inputs & Dropdowns**: Background `#0F111A`, border `#2A2F45`, focus border `#8B5CF6` + purple glow.
- **Checkboxes & Radio Buttons**: Replaced OS defaults with custom styled rounded SVG boxes/radios in `#8B5CF6`.
- **Sliders**: Styled purple track with filled progress bar and purple thumb handle + value badge.
- **Color Swatches**: Custom rounded square color pills with `#8B5CF6` border selection ring.
- **Signature Element**: 2px top border gradient indicator (`#8B5CF6` to `#06B6D4`) on active cards and section headers.

---

## 3. Screen-by-Screen Layout Redesigns

### 3.1. Dashboard Screen (`DashboardScreen.tsx`)
- **Card Hierarchy**:
  - Main primary action button: **"Mở"** (`#8B5CF6` purple).
  - Secondary action icons (Copy, Edit, Delete): Grouped subtly with hover tooltips or compact icon cluster to avoid competing with "Mở".
  - Thumbnail hover state: Subtle zoom and dark overlay transition.

### 3.2. TTS Screen (`TtsScreen.tsx`)
- **Balanced 2-Column Layout**:
  - Left Column (60%): Text script input, Voice & Language selection.
  - Right Column (40%): Speech controls (Speed, Pitch, Prompt style), Audio format, Synthesis action button & audio player.
- Custom styled dropdowns, sliders, and buttons.

### 3.3. Subtitle Aligner Screen (`AlignerScreen.tsx`)
- **Balanced 2-Column Layout**:
  - Left Column (65%): Audio file picker, Script input area, Generation action button.
  - Right Column (35%): Subtitle options (Sentence vs Word level, Auto-detect), Whisper Local status card integrated seamlessly.
- Custom radio buttons and checkboxes.

### 3.4. Vertical 9:16 Converter Screen (`VerticalConvertScreen.tsx`)
- **Sectioned Card Layout**:
  - Left Section: Grouped into distinct cards:
    - Card 1: *Source Files* (Video & SRT picker).
    - Card 2: *Text & Title Styling* (Font size, position, custom square color swatches).
    - Card 3: *Export Resolution* (720p, 1080p, 4K pills).
  - Right Section: Live Vertical Preview frame (9:16 layout preview).

### 3.5. API Settings Screen (`AppSettingsScreen.tsx`)
- **Zero-Scroll 2-Column Grid**:
  - Left Column: *Google Cloud OAuth 2.0 Credentials* block.
  - Right Column:
    - Upper Card: *Chirp Streaming Credentials* (JSON file picker).
    - Lower Card: *OpenAI API Key* (Input + Save button).
  - Eliminates vertical full-width stacking and page scrolling.

---

## 4. Verification Plan

### Automated Tests
- Run `npm test` to ensure zero regressions in business logic or utility helpers.

### Manual UI Verification
- Verify all 5 screens fit within viewport without unnecessary scrolling.
- Confirm keyboard focus ring visibility on all custom inputs and buttons.
- Confirm 100% feature functionality remains identical.

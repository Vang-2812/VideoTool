# UI/UX Modernization & Design System Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign and standardize the UI across all screens of the application (Dashboard, TTS, Subtitle Aligner, Vertical Converter, API Settings) using a unified Design Token system, custom-styled controls (checkboxes, radio buttons, sliders, dropdowns, swatches), zero-scroll multi-column layouts, and distinct visual hierarchy.

**Architecture:**
- `src/index.css`: Defines CSS design variables (`--accent-purple`, `--bg-main`, `--bg-surface`, custom range sliders, custom checkboxes/radios).
- `src/components/DashboardScreen.tsx`: Visual hierarchy for card action buttons, thumbnail hover zoom.
- `src/components/TtsScreen.tsx`: Balanced 2-column layout.
- `src/components/AlignerScreen.tsx`: Balanced 2-column layout, custom radio/checkbox controls.
- `src/components/VerticalConvertScreen.tsx`: Sectioned card grouping, custom square color swatches.
- `src/components/AppSettingsScreen.tsx`: Zero-scroll 2-column layout for Google OAuth, Chirp, and OpenAI credentials.

---

### Task 1: Update Global Design Tokens & Custom Controls (`src/index.css`)

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add custom control styles and design tokens in `src/index.css`**

Add CSS custom classes for:
- `.accent-gradient-border`: Signature 2px top gradient indicator line (`#8B5CF6` to `#06B6D4`).
- `.custom-slider`: Custom purple slider track & thumb styling.
- `.custom-checkbox`, `.custom-radio`: Custom styled checkboxes and radio buttons replacing native OS defaults.
- `.color-swatch-selected`: Custom square color swatch selection outline.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add unified design token CSS classes and custom controls"
```

---

### Task 2: Redesign Dashboard Screen (`src/components/DashboardScreen.tsx`)

**Files:**
- Modify: `src/components/DashboardScreen.tsx`

- [ ] **Step 1: Refactor Project Card action buttons & thumbnail hover states**
  - Make primary "Mở" button prominent with `#8B5CF6` purple background.
  - Group secondary icons (Copy, Edit, Delete) into a subtle icon cluster with tooltips.
  - Add smooth thumbnail hover scale (`group-hover:scale-105 transition-transform duration-300`).

- [ ] **Step 2: Run tests & build check**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/DashboardScreen.tsx
git commit -m "style: redesign Dashboard project cards with clear action hierarchy"
```

---

### Task 3: Redesign TTS Screen (`src/components/TtsScreen.tsx`)

**Files:**
- Modify: `src/components/TtsScreen.tsx`

- [ ] **Step 1: Re-layout TTS Screen into a balanced 2-column layout**
  - Left Column: Script Text Input & Voice / Language Selection.
  - Right Column: Speech Controls (Speed, Pitch, Prompt style), Audio Format, Generate Button & Audio Player.
  - Apply custom purple sliders and dropdowns.

- [ ] **Step 2: Run tests & build check**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/TtsScreen.tsx
git commit -m "style: redesign TTS screen into a balanced 2-column layout"
```

---

### Task 4: Redesign Subtitle Aligner Screen (`src/components/AlignerScreen.tsx`)

**Files:**
- Modify: `src/components/AlignerScreen.tsx`

- [ ] **Step 1: Re-layout Subtitle Aligner into a 2-column layout**
  - Left Column: Audio File Input, Script Text Area, Generate SRT Action Button.
  - Right Column: Subtitle Mode (Sentence vs Word level with custom radio buttons), Auto-detect toggle, integrated Whisper Local Status Card.

- [ ] **Step 2: Run tests & build check**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/AlignerScreen.tsx
git commit -m "style: redesign Subtitle Aligner screen into a balanced 2-column layout"
```

---

### Task 5: Redesign Vertical 9:16 Convert Screen (`src/components/VerticalConvertScreen.tsx`)

**Files:**
- Modify: `src/components/VerticalConvertScreen.tsx`

- [ ] **Step 1: Section controls into distinct cards & replace color dots**
  - Left Side: Group into 3 distinct Cards (*1. File Nguồn*, *2. Cấu Hình Chữ & Tiêu Đề*, *3. Độ Phân Giải*).
  - Replace circular native color picker dots with custom rounded square color swatches (`rounded-lg`, `#8B5CF6` ring selection).
  - Right Side: Live Vertical Layout Preview (9:16).

- [ ] **Step 2: Run tests & build check**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/VerticalConvertScreen.tsx
git commit -m "style: section Vertical Converter controls and add custom color swatches"
```

---

### Task 6: Redesign API Settings Screen (`src/components/AppSettingsScreen.tsx`)

**Files:**
- Modify: `src/components/AppSettingsScreen.tsx`

- [ ] **Step 1: Re-layout API Settings into a zero-scroll 2-column grid**
  - Left Column: *Google Cloud OAuth 2.0 Credentials* block.
  - Right Column:
    - Top Card: *Chirp Streaming Credentials* JSON file picker.
    - Bottom Card: *OpenAI API Key* input & save action.
  - Ensures 100% of setting cards fit in viewport without vertical scrolling.

- [ ] **Step 2: Run tests & build check**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/AppSettingsScreen.tsx
git commit -m "style: redesign API Settings into zero-scroll 2-column grid layout"
```

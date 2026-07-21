# Collapsible Sidebar Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move main module navigation from the top Header to a left Collapsible Sidebar component (`Sidebar.tsx`) supporting expanded (240px) and collapsed (64px) states with toggle button and localStorage persistence. Streamline top Header to display breadcrumbs, progress tracker, and project action buttons.

**Architecture:**
- `src/components/Sidebar.tsx`: Collapsible sidebar component with logo, module navigation tabs, tooltips, and collapse toggle.
- `src/App.tsx`: Main layout refactoring to include `Sidebar` on left side and streamlined header on top.

---

### Task 1: Create Collapsible Sidebar Component (`src/components/Sidebar.tsx`)

**Files:**
- Create: `src/components/Sidebar.tsx`

**Interfaces:**
- Produces `Sidebar` props: `{ activeModule: string, onSelectModule: (module: string) => void }`

- [ ] **Step 1: Implement `src/components/Sidebar.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import logoUrl from '../logo.svg';
import { 
  Film, 
  Mic, 
  Volume2, 
  Smartphone, 
  Video, 
  Settings,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

export type ModuleId = 'storyboard' | 'tts' | 'aligner' | 'vertical' | 'reup' | 'settings';

interface SidebarProps {
  activeModule: ModuleId;
  onSelectModule: (module: ModuleId) => void;
}

const MODULE_ITEMS: { id: ModuleId; label: string; icon: React.ElementType }[] = [
  { id: 'storyboard', label: 'Dự Án', icon: Film },
  { id: 'tts', label: 'Tạo Giọng Đọc (TTS)', icon: Mic },
  { id: 'aligner', label: 'Tạo Phụ Đề', icon: Volume2 },
  { id: 'vertical', label: 'Convert Dọc 9:16', icon: Smartphone },
  { id: 'reup', label: 'Reup Video', icon: Video },
  { id: 'settings', label: 'Cài Đặt API', icon: Settings }
];

export default function Sidebar({ activeModule, onSelectModule }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(isCollapsed));
  }, [isCollapsed]);

  return (
    <aside 
      className={`bg-bg-panel border-r border-border-dark flex flex-col justify-between shrink-0 transition-all duration-300 relative z-20 ${isCollapsed ? 'w-16' : 'w-60'}`}
    >
      {/* Top Header Branding inside Sidebar */}
      <div className="p-3.5 border-b border-border-dark flex items-center justify-between gap-3 overflow-hidden">
        <div className="flex items-center gap-3 min-w-0">
          <img src={logoUrl} className="w-8 h-8 rounded-lg object-contain shrink-0" alt="Logo" />
          {!isCollapsed && (
            <div className="truncate">
              <h1 className="text-xs font-bold text-white tracking-wide truncate">Storyboard Tool</h1>
              <span className="text-[9px] text-gray-500 font-mono uppercase tracking-wider block mt-0.5">v1.7 (Forced Aligner)</span>
            </div>
          )}
        </div>

        {/* Toggle Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 hover:bg-bg-dark text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
          title={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Module Items */}
      <nav className="flex-1 p-2 space-y-1.5 overflow-y-auto">
        {MODULE_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectModule(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 ${isActive ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white hover:bg-bg-dark'}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer info in Sidebar */}
      {!isCollapsed && (
        <div className="p-3.5 border-t border-border-dark text-[10px] text-gray-600 font-mono text-center">
          Local Pipeline 100%
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add Sidebar component for collapsible module navigation"
```

---

### Task 2: Refactor Top Header & Layout (`src/App.tsx`)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Integrate Sidebar and simplify Top Header in `src/App.tsx`**

1. Import `Sidebar` from `./components/Sidebar`.
2. Wrap `MainLayout` in a horizontal flex layout (`flex flex-row h-full overflow-hidden`).
3. Place `<Sidebar activeModule={activeModule} onSelectModule={setActiveModule} />` on left side.
4. Simplify top header to show Breadcrumbs on left, Stepper in center, and Action buttons on right.

- [ ] **Step 2: Run tests & build check**

Run: `npm test && npm run build`
Expected: PASS 100%

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: integrate collapsible left sidebar and streamline top header"
```

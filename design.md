# 🎨 NotesRAG — UI/UX Design Direction

---

## 1. Design Philosophy

NotesRAG's UI is built around three core principles:

1. **Minimal & Precise**: Every element exists for a reason. No decorative chrome. No padding that wastes information density. The interface steps aside and lets the RAG output take center stage.
2. **Trustworthy & Transparent**: The system makes it immediately obvious what documents are loaded, what retrieval mode is active (FAISS vs Edge), and what raw evidence was used to generate each answer. Transparency is a feature, not an afterthought.
3. **Alive & Responsive**: The UI communicates system state continuously through subtle motion: typewriter streaming, pulse-dot loading indicators, smooth transitions, and hover affordances.

---

## 2. Visual Identity

### 2.1 Color Palette

| Role | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| **Brand / Accent** | `#10b981` (emerald-500) | `#10b981` (emerald-500) | CTA buttons, links, active states, scores, streaming cursor |
| **Surface Primary** | `slate-50` (#f8fafc) | `zinc-950` (#09090b) | Full-page background |
| **Surface Cards** | `white` (#ffffff) | `zinc-900` (#18181b) | Message bubbles, form fields, chip backgrounds |
| **Border** | `slate-200` (#e2e8f0) | `zinc-800` (#27272a) | All dividers, outlines, separators |
| **Text Primary** | `slate-900` (#0f172a) | `zinc-100` (#f4f4f5) | Headings, primary body text |
| **Text Secondary** | `slate-600` (#475569) | `zinc-400` (#a1a1aa) | Metadata, labels, timestamps |
| **Text Muted / Mono** | `slate-500` (#64748b) | `zinc-500` (#71717a) | Latency stats, chunk IDs, token counts |
| **User Bubble** | `slate-900` (#0f172a) | `zinc-800` (#27272a) | User chat bubbles (dark on both modes) |
| **Citation Accent** | `cyan-600` (#0891b2) | `cyan-400` (#22d3ee) | Document names in citation cards |
| **Error / Stop** | `red-500` (#ef4444) | `red-500` (#ef4444) | Stop button, error states |
| **Connecting / Edge** | `cyan-400` (#22d3ee) | `cyan-400` (#22d3ee) | Serverless edge mode status indicator |

### 2.2 Typography

| Element | Font | Weight | Size |
|---|---|---|---|
| **Body / UI** | Geist Sans (Google) | 400, 500, 600 | 14px / 15px (`text-sm`) |
| **Headings** | Geist Sans | 700 | `text-xl` to `text-2xl` |
| **Monospace / Code** | Geist Mono | 400, 600 | `text-xs` (`text-[11px]` for metadata) |
| **Metadata chips** | Geist Mono | 600 | `text-[10px]` to `text-xs` |

> All text uses `-webkit-font-smoothing: antialiased` for premium screen rendering on macOS and Linux.

### 2.3 Radii & Spacing

- **Buttons / chips**: `rounded-full` (pill shape) for primary actions; `rounded-lg` for secondary.
- **Message cards**: `rounded-2xl` + directional corner tweak (`rounded-bl-sm` for assistant, `rounded-br-sm` for user).
- **Citation cards**: `rounded-xl` outer container; `rounded-lg` inner chunk cards.
- **Consistent inner padding**: `p-4` cards, `p-3.5` chunk cards, `px-5 py-1.5` input field.

---

## 3. Layout Architecture

### 3.1 Two-Screen View Model

The app has exactly **two full-screen views**, transitioning when documents are loaded:

```
State: No documents loaded         State: Documents loaded
┌────────────────────────┐         ┌────────────────────────┐
│      Upload View       │ ──────► │  Minimal Chat View     │
│                        │         │                        │
│  [Logo + Tagline]      │         │  [Nav Bar: file chip,  │
│  [Dropzone]            │         │   upload, theme, clear]│
│  [Progress Bar]        │         │  ─────────────────────  │
│  [Sample Presets]      │         │  [Message Thread]       │
│  [Feature Pills]       │         │  [Loading Pulse Dots]   │
│                        │         │  ─────────────────────  │
│  [Backend Status]      │         │  [Input Bar]            │
└────────────────────────┘         └────────────────────────┘
```

### 3.2 Chat View Layout

```
┌────────────────────────────────────────────────────────┐
│ NAV BAR (sticky, h-14, backdrop-blur)                  │
│  [File Chip] [Upload More]       [Status] [☀/☾] [Clear]│
├────────────────────────────────────────────────────────┤
│ SCROLL AREA (flex-1, overflow-y-auto)                  │
│                                                        │
│  [Empty State — suggestions grid]                      │
│  OR                                                    │
│  [User Bubble — dark pill, right-aligned]              │
│  [Assistant Card — white card, left-aligned]           │
│    ├─ Model badge + latency metrics                    │
│    ├─ Markdown-rendered response content               │
│    ├─ Streaming cursor (blinking green block)          │
│    ├─ [Copy Answer] [Citation Proof (N)] buttons       │
│    └─ Citation Proof Panel (collapsible)               │
│         └─ Chunk Cards: [Doc name, Chunk #, % match]  │
│              └─ Blockquote: verbatim chunk text        │
│              └─ Token count + L2 distance              │
│  [Loading Pulse Dots]                                  │
│                                                        │
├────────────────────────────────────────────────────────┤
│ [Stop Generating — floating pill, red]                 │
├────────────────────────────────────────────────────────┤
│ INPUT BAR                                              │
│  [Pill-shaped input] ─────────────────── [Send / Stop]│
│  "Press Enter to ask. Fast, grounded, verified."       │
└────────────────────────────────────────────────────────┘
```

### 3.3 Upload View Layout

```
┌────────────────────────────────────────────────────────┐
│                   (Full-screen centered)               │
│  ⚡ NotesRAG                                           │
│  FAISS + Groq RAG System    [☀/☾ button]              │
│  v2.0 · Production Ready                               │
│                                                        │
│  [Backend Status Pill]                                 │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │           DROPZONE                               │  │
│  │  [Upload icon + dashed border]                   │  │
│  │  "Drag & drop your notes, PDFs, or text files"   │  │
│  │  "PDF · TXT · DOCX · JSON · CSV · XLSX"         │  │
│  │  [Browse Files button]                            │  │
│  │                                                   │  │
│  │  [Progress bar + stage label] (when uploading)   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ─── or explore sample presets ───                     │
│  [ML Notes] [Python Guide] [RAG Architecture]          │
│                                                        │
│  ┌─ Feature Highlights ──────────────────────────────┐ │
│  │ [FAISS Vector Search] [Groq LPU] [Multi-format]  │ │
│  └───────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

---

## 4. Micro-Interactions & Animation

### 4.1 Defined Animations

| Name | CSS | Trigger | Description |
|---|---|---|---|
| **Typewriter stream** | JS interval (20ms) | New assistant message | Tokens rendered 2 at a time via `setInterval` |
| **Streaming cursor** | `@keyframes blink` 0.9s infinite | While message is streaming | Blinking 7×15px emerald block |
| **Loading pulse dots** | `@keyframes pulseDot` 1.2s, staggered 0.2s | While `isLoading=true` | Three emerald dots scale between 0.6→1.1 |
| **Upload progress ticker** | JS interval (200ms) | During file processing | Progress increments with exponential falloff |
| **Hover scale** | `hover:scale-105` | Send button | Subtle grow on hover |
| **Fade transition** | `transition-colors duration-200` | Theme toggle | Smooth color shift on dark/light switch |

### 4.2 Interaction States

Every interactive element must have explicit visual responses for these states:
- **Default**: Base visual
- **Hover**: Border color shift to emerald or opacity bump (`hover:bg-slate-100 dark:hover:bg-zinc-800`)
- **Focus**: Ring 2 emerald around input (`focus-within:ring-2 focus-within:ring-emerald-500/20`)
- **Active**: Scale or background shift
- **Disabled**: `opacity-40 cursor-not-allowed`

---

## 5. Status Communication

### 5.1 Backend Mode Indicator (Nav bar, always visible)
```
●  FAISS Active     ← Green dot  (Python backend reachable)
●  Edge RAG         ← Cyan dot   (Serverless mode, no backend)
```

### 5.2 Upload Progress Stages
```
0% → "Uploading N document(s)..."
40% → "Extracting text and chunking content..."
70% → "Vectorizing & generating embeddings..."
100% → "Success! All documents indexed."
```

### 5.3 Empty State Suggestions
Dynamic suggestions appear based on the active document type:
- ML files → 3 ML-specific conceptual questions
- Python files → 3 Python-specific technical questions
- Other → 3 generic summarization / analysis prompts

---

## 6. Component Visual Specification

### 6.1 Pill Chip (File Name, Status)
```
bg-white / zinc-900  ·  border-slate-200 / zinc-800
rounded-full  ·  px-3 py-1  ·  text-xs font-semibold
text-emerald-600 / emerald-400
```

### 6.2 Assistant Message Card
```
bg-white / zinc-900  ·  border-slate-200 / zinc-800/80
p-5  ·  rounded-2xl rounded-bl-sm  ·  shadow-sm
```
- Header separator: `border-b border-slate-100 / zinc-800/60`
- Content: `text-sm leading-relaxed text-slate-800 / zinc-200`
- Footer separator: `border-t border-slate-100 / zinc-800/60`

### 6.3 User Message Bubble
```
bg-slate-900 / zinc-800  ·  text-white
px-4 py-3  ·  rounded-2xl rounded-br-sm  ·  shadow-sm
max-w-[85%] self-end
```

### 6.4 Citation Chunk Card
```
bg-white / zinc-900  ·  border-slate-200 / zinc-800/80
p-3.5  ·  rounded-lg
Header: doc name (cyan) + chunk badge + match % with mini bar
Body: blockquote with border-l-2 border-emerald-500
Footer: mono token + L2 distance
```

### 6.5 Input Bar
```
bg-white / zinc-900  ·  border-slate-300 / zinc-700/80
rounded-full  ·  py-1.5 pl-5 pr-2
focus-within: border-emerald-500 + ring-2 ring-emerald-500/20
Send button: w-9 h-9 rounded-full bg-emerald-500 text-zinc-950
Stop button: w-9 h-9 rounded-full bg-red-500 text-white
```

---

## 7. Accessibility

- All icon-only buttons include a `title` attribute describing the action.
- Color information (status dot colors) is supplemented by text labels ("FAISS Active", "Edge RAG").
- Keyboard navigation: the input field has `autoFocus`; form submits on `Enter`.
- All interactive elements maintain at minimum WCAG 2.1 AA contrast ratios.
- `backdrop-blur-md` containers include `bg-slate-50/80` fallback opacity to ensure legibility on all backgrounds.

---

## 8. Responsive Design

| Breakpoint | Adjustments |
|---|---|
| Mobile (`< sm`) | Nav labels hidden (icon-only), max-width 85% bubbles, smaller text (`text-sm`), `px-4` padding |
| Tablet/Desktop (`≥ sm`) | Nav labels visible, `px-6` padding, `text-[0.93rem]` content |
| Max container | `max-w-4xl mx-auto` — content never exceeds 896px centered on wide displays |

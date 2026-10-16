# 📐 NotesRAG — Coding Rules & Engineering Standards

---

## 1. General Principles

1. **Readability over Cleverness**: Write code that the next developer can understand immediately. Clever one-liners that sacrifice clarity are not acceptable.
2. **Fail Loud, Recover Gracefully**: Errors must be caught at appropriate boundaries. Never silently swallow exceptions that affect functionality.
3. **No Magic Numbers**: Named constants over inline numeric literals everywhere.
4. **Separation of Concerns**: Each file/class/function has a single clear purpose. Do not mix UI logic, data loading, and LLM orchestration in the same module.
5. **Don't Repeat Yourself (DRY)**: Extract shared logic into reusable utilities.

---

## 2. Python (Backend) Rules

### 2.1 Style & Formatting
- Follow **PEP 8** strictly. Use `ruff` for formatting and linting.
- Maximum line length: **100 characters**.
- All functions, classes, and modules must have **docstrings** (Google style).
- Use **type hints** on all function signatures — both parameters and return types.

```python
# ✅ Correct
def retrieve_context(self, query: str, top_k: int = 5) -> List[Dict]:
    """Retrieve relevant document chunks for the query.

    Args:
        query: The user's raw query string.
        top_k: Number of top similar chunks to return.

    Returns:
        A list of metadata dictionaries for the top-K chunks.
    """
    ...

# ❌ Wrong — no type hints, no docstring
def retrieve(query, k=5):
    ...
```

### 2.2 Module Imports
- Standard library imports first, then third-party, then local — separated by blank lines.
- Use absolute imports within `src/` (e.g., `from src.vectorstore import FaissVectorStore`).

### 2.3 Error Handling
- Use specific exception types, never bare `except:`.
- In FastAPI endpoints, always raise `HTTPException` with a descriptive `detail` string.
- Log to console with `[INFO]`, `[WARNING]`, `[ERROR]` prefixes for operability.

```python
# ✅ Correct FastAPI error pattern
try:
    docs = load_all_documents("data")
except Exception as e:
    raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")

# ❌ Wrong — silent failure
try:
    docs = load_all_documents("data")
except:
    pass
```

### 2.4 FastAPI Endpoint Standards
- Use **Pydantic `BaseModel`** for all request bodies — never raw `dict`.
- All endpoints must have a descriptive **docstring** that appears in the OpenAPI schema.
- Validate inputs (empty strings, missing files) before processing.
- Return consistent JSON shapes: `{ status, message, data }` pattern.

### 2.5 Async vs Sync
- Keep all FastAPI route handlers **synchronous** (standard `def`) unless you have explicit I/O-bound operations that benefit from `async def`.
- File I/O and `faiss` operations are **synchronous** — do not wrap them in fake async coroutines.

### 2.6 Environment Variables
- Load via `python-dotenv`'s `load_dotenv()` at module top.
- Never hardcode API keys, model names, or file paths as string literals in source.
- Always provide a default for optional environment variables: `os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")`.

### 2.7 Vector Store & Embedding
- Always call `vectorstore.save()` after building or appending embeddings.
- Embeddings must be cast to `float32` before adding to FAISS: `np.array(embeddings).astype("float32")`.
- Default chunk parameters: `chunk_size=500`, `chunk_overlap=150`. Override only with explicit justification.

---

## 3. TypeScript / Next.js (Frontend) Rules

### 3.1 Style & Formatting
- Use **strict TypeScript** (`"strict": true` in `tsconfig.json`).
- No `any` types — use `unknown` + type narrowing or define proper interfaces.
- Prefer `const` over `let`; never use `var`.
- Maximum line length: **120 characters**.

```typescript
// ✅ Correct — typed, no any
const message = error instanceof Error ? error.message : "Upload error";

// ❌ Wrong — any type
const handle = (error: any) => console.log(error);
```

### 3.2 Component Rules
- All components are **function components** — no class components.
- Use `"use client"` directive only when the component requires browser-only APIs (state, effects, events).
- Components that only render JSX (pure presentational) should have **no state** and not be marked as `"use client"`.
- Props interfaces must be named `<ComponentName>Props` and explicitly typed.

```typescript
// ✅ Correct
interface UploadViewProps {
  onFilesSelected: (files: File[]) => Promise<boolean>;
  isBackendConnected: boolean;
}
export function UploadView({ onFilesSelected, isBackendConnected }: UploadViewProps) { ... }
```

### 3.3 React Hooks Rules
- **Unconditional hook calls only**: All hooks must be declared at the top of the component body before any early return statements.
- Use `useCallback` for event handlers passed as props to avoid unnecessary re-renders.
- Clean up intervals and timers in `useEffect` return functions.

```typescript
// ✅ Correct — all hooks declared before early return
export function ReportsPage({ data }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  if (!data) return <EmptyState />;
  ...
}

// ❌ Wrong — hook after early return violates Rules of Hooks
export function ReportsPage({ data }: Props) {
  if (!data) return <EmptyState />;
  const [open, setOpen] = useState(false); // RUNTIME ERROR
  ...
}
```

### 3.4 Next.js API Route Rules
- All route handlers must be `async` and return a `NextResponse.json(...)`.
- Always wrap the full handler body in a `try/catch` — never let unhandled exceptions crash the route.
- Validate all inputs at the start of the route before any processing.
- Return meaningful error messages with proper HTTP status codes (400 for client errors, 500 for server errors).

```typescript
// ✅ Correct pattern
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.query?.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }
    // ... processing
    return NextResponse.json({ answer, chunks });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### 3.5 State Management
- Keep state as **close to where it's used** as possible.
- Lift state up to `page.tsx` only when two or more sibling components need it.
- No global state libraries (Redux, Zustand) — React state + props is sufficient for this app size.

### 3.6 Type Definitions
- All shared types live in `src/types/rag.ts`. Do not define types inline in component files unless they are component-local.
- Use `interface` for object shapes and `type` for unions/intersections.

---

## 4. CSS & Styling Rules

- Use **TailwindCSS utility classes** for layout and spacing.
- Define **CSS custom properties (variables)** in `globals.css` for all theme-sensitive values (colors, shadows, blur).
- Light/dark mode is controlled via `data-theme` attribute on `<html>` — never via JavaScript inline styles.
- Do not inline `style={{ color: "red" }}` — use Tailwind classes or CSS variables instead.
- Use `backdrop-filter: blur()` and `bg-opacity` for glassmorphism effects, not box-shadow hacks.

---

## 5. Git & Version Control Rules

- **Commit message format**: `<type>: <short description>` (max 72 chars)
  - Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`
  - Example: `feat: add streaming SSE endpoint for real-time token output`
- **Never commit**: `.env`, `.env.local`, `faiss_store/`, `data/pdf/*.pdf`, `__pycache__/`, `.next/`, `node_modules/`.
- Branch naming: `feature/<feature-name>`, `fix/<issue>`, `docs/<topic>`.
- No direct commits to `main` — all changes via PR + self-review.

---

## 6. Environment & Security Rules

- **No secrets in source code** — ever. All API keys via `.env` / Vercel environment variables.
- **CORS**: In production FastAPI, `allow_origins` must be restricted to known Vercel preview and production URLs. The current `"*"` is acceptable only for local dev.
- **Input sanitization**: All user query strings must be stripped (`str.strip()`) before processing.
- **File validation**: Uploaded files should only be processed for supported extensions. Unknown file types are skipped with a warning, not silently stored.

---

## 7. Performance Rules

- **Never load full documents into memory** when chunked streaming is possible.
- **Memoize expensive computations**: Initial chunk embeddings should be cached once and reused for the session's lifetime.
- **Debounce health checks**: The backend health poll interval must be `≥ 15 seconds` to avoid spamming the server.
- **Abort stale requests**: Always use `AbortController` for fetch calls that may be superseded by newer user actions.

---

## 8. Documentation Rules

- Every Python module must have a module-level docstring explaining its purpose.
- Every new frontend component must have a JSDoc comment block above the function signature.
- Complex algorithms (chunking logic, TF-IDF scoring, L2→similarity conversion) must have inline comments explaining the math.
- Keep `README.md`, `prd.md`, `architecture.md`, `tasks.md`, and `memory.md` up to date with each significant feature addition.

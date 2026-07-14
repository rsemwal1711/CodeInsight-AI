import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import Editor from "@monaco-editor/react";
import Footer from '../components/Footer';
import { useTheme } from "../context/ThemeContext"; // adjust path
import NavBar from "../components/Header";
import "./HomePage.css";
import "./AnalyzePage.css";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/* ==========================================================================
   This page now calls a real backend (Node/Express + tree-sitter — see
   /backend-node) instead of guessing client-side. Point this at wherever
   you deploy the API; for local dev, `node server.js` in backend-node/
   serves it on port 8000 by default.

   Language is no longer chosen by the user — they just write code, and
   the backend detects the language and reports it back in the results.
   ========================================================================== */

/* Maps a backend-reported language name to a Monaco language id + file
   extension, purely for editor syntax highlighting / the fake filename. */
const LANGUAGE_META = {
  javascript: { label: "JavaScript", ext: "js" },
  typescript: { label: "TypeScript", ext: "ts" },
  python: { label: "Python", ext: "py" },
  java: { label: "Java", ext: "java" },
  cpp: { label: "C++", ext: "cpp" },
  c: { label: "C", ext: "c" },
};

const DEFAULT_META = { label: "Auto", ext: "txt" };

function resolveLanguageMeta(name) {
  if (!name) return { id: "javascript", ...DEFAULT_META };
  const id = String(name).trim().toLowerCase();
  if (LANGUAGE_META[id]) return { id, ...LANGUAGE_META[id] };
  return { id: "javascript", ...DEFAULT_META };
}

// Weights are only used to draw the "Performance Comparison" bars — the
// complexity values themselves come from the backend.
const COMPLEXITY_WEIGHT = {
  "O(1)": 8,
  "O(log n)": 16,
  "O(n)": 32,
  "O(n log n)": 45,
  "O(n\u00B2)": 75,
  "O(n\u00B3)": 95,
  "O(n\u2074)": 100,
  "O(2\u207F)": 100,
  Unknown: 0,
};

/* ---------- History (localStorage) ---------- */

const HISTORY_KEY = "ci-analysis-history";
const HISTORY_LIMIT = 25;

function loadHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — degrade gracefully
    return [];
  }
}

function persistHistory(entries) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    /* storage full or unavailable — silently ignore, UI state still updates */
  }
}

function pushHistoryEntry(entry) {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_LIMIT);
  persistHistory(next);
  return next;
}

function formatTimestamp(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

/* ---------- Editor zoom (ctrl/cmd+scroll, trackpad pinch, touch pinch) ---------- */

const MIN_EDITOR_FONT_SIZE = 10;
const MAX_EDITOR_FONT_SIZE = 28;

/* Reusable across every Monaco instance on this page (main editor,
   optimized-code block, fullscreen modal). Trackpad pinch arrives in the
   browser as a wheel event with ctrlKey set automatically, so the same
   wheel listener covers ctrl/cmd+scroll AND trackpad pinch — only real
   touch-screen pinch needs separate touch listeners. */
function useEditorZoom(initialFontSize) {
  const [fontSize, setFontSize] = useState(initialFontSize);

  const handleEditorMount = useCallback((editor) => {
    const domNode = editor.getDomNode();
    if (!domNode) return;

    domNode.addEventListener(
      "wheel",
      (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        e.stopPropagation();
        setFontSize((prev) => {
          const delta = e.deltaY < 0 ? 1 : -1;
          const next = Math.min(MAX_EDITOR_FONT_SIZE, Math.max(MIN_EDITOR_FONT_SIZE, prev + delta));
          editor.updateOptions({ fontSize: next });
          return next;
        });
      },
      { passive: false }
    );

    let initialDistance = null;
    let initialSize = fontSize;

    const getDistance = (touches) => {
      const [a, b] = touches;
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };

    domNode.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2) {
          initialDistance = getDistance(e.touches);
          initialSize = fontSize;
        }
      },
      { passive: true }
    );

    domNode.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 2 && initialDistance) {
          e.preventDefault();
          const currentDistance = getDistance(e.touches);
          const scale = currentDistance / initialDistance;
          const next = Math.min(
            MAX_EDITOR_FONT_SIZE,
            Math.max(MIN_EDITOR_FONT_SIZE, Math.round(initialSize * scale))
          );
          setFontSize(next);
          editor.updateOptions({ fontSize: next });
        }
      },
      { passive: false }
    );

    domNode.addEventListener("touchend", () => {
      initialDistance = null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSize]);

  return [fontSize, handleEditorMount];
}

/* ---------- Monaco theme (VS Code–style, tuned to the brand palette) ---------- */

function registerTheme(monaco) {
  // We use "javascript" purely as a default tokenizer for coloring before
  // the real language is known — the code typed often isn't valid JS
  // (e.g. Java/C++/Python), so disable Monaco's JS/TS error checking to
  // avoid false "errors" like undeclared variables or unknown types.
  if (monaco.languages.typescript) {
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      noSuggestionDiagnostics: true,
    });
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      noSuggestionDiagnostics: true,
    });
  }

  monaco.editor.defineTheme("ciDark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6b7a99", fontStyle: "italic" },
      { token: "keyword", foreground: "c084fc", fontStyle: "bold" },
      { token: "keyword.control", foreground: "c084fc", fontStyle: "bold" },
      { token: "keyword.operator", foreground: "f472b6" },
      { token: "string", foreground: "4ade80" },
      { token: "string.escape", foreground: "f472b6" },
      { token: "number", foreground: "fb923c" },
      { token: "regexp", foreground: "f472b6" },
      { token: "type", foreground: "5eead4" },
      { token: "type.identifier", foreground: "5eead4" },
      { token: "identifier", foreground: "7dd3fc" },
      { token: "variable", foreground: "7dd3fc" },
      { token: "variable.predefined", foreground: "fca5a5" },
      { token: "constant", foreground: "fca5a5" },
      { token: "delimiter", foreground: "94a3b8" },
      { token: "delimiter.bracket", foreground: "e2b8ff" },
      { token: "operator", foreground: "f472b6" },
      { token: "function", foreground: "60a5fa" },
      { token: "predefined", foreground: "60a5fa" },
      { token: "annotation", foreground: "facc15" },
      { token: "tag", foreground: "fb7185" },
      { token: "attribute.name", foreground: "fbbf24" },
      { token: "attribute.value", foreground: "4ade80" },
      { token: "namespace", foreground: "5eead4" },
      { token: "class", foreground: "5eead4" },
    ],
    colors: {
      "editor.background": "#131c31",
      "editor.foreground": "#f1f5f9",
      "editor.lineHighlightBackground": "#1a2540",
      "editor.selectionBackground": "#3b82f640",
      "editorCursor.foreground": "#3B82F6",
      "editorLineNumber.foreground": "#475569",
      "editorLineNumber.activeForeground": "#94a3b8",
      "editorIndentGuide.background": "#1e293b",
      "editorIndentGuide.activeBackground": "#334155",
      "editorGutter.background": "#131c31",
      "scrollbarSlider.background": "#33415580",
      "scrollbarSlider.hoverBackground": "#475569a0",
      "editorWidget.background": "#161f36",
      "editorSuggestWidget.background": "#161f36",
    },
  });

  monaco.editor.defineTheme("ciLight", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6b7280", fontStyle: "italic" },
      { token: "keyword", foreground: "9333ea", fontStyle: "bold" },
      { token: "keyword.control", foreground: "9333ea", fontStyle: "bold" },
      { token: "keyword.operator", foreground: "db2777" },
      { token: "string", foreground: "15803d" },
      { token: "string.escape", foreground: "db2777" },
      { token: "number", foreground: "c2410c" },
      { token: "regexp", foreground: "db2777" },
      { token: "type", foreground: "0d9488" },
      { token: "type.identifier", foreground: "0d9488" },
      { token: "identifier", foreground: "1e3a8a" },
      { token: "variable", foreground: "1e3a8a" },
      { token: "variable.predefined", foreground: "b91c1c" },
      { token: "constant", foreground: "b91c1c" },
      { token: "delimiter", foreground: "64748b" },
      { token: "delimiter.bracket", foreground: "7c3aed" },
      { token: "operator", foreground: "db2777" },
      { token: "function", foreground: "1d4ed8" },
      { token: "predefined", foreground: "1d4ed8" },
      { token: "annotation", foreground: "b45309" },
      { token: "tag", foreground: "be123c" },
      { token: "attribute.name", foreground: "a16207" },
      { token: "attribute.value", foreground: "15803d" },
      { token: "namespace", foreground: "0d9488" },
      { token: "class", foreground: "0d9488" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#1e293b",
      "editor.lineHighlightBackground": "#f1f5f9",
      "editor.selectionBackground": "#93c5fd66",
      "editorCursor.foreground": "#2563eb",
      "editorLineNumber.foreground": "#94a3b8",
      "editorLineNumber.activeForeground": "#475569",
      "editorIndentGuide.background": "#e2e8f0",
      "editorIndentGuide.activeBackground": "#cbd5e1",
      "editorGutter.background": "#ffffff",
      "scrollbarSlider.background": "#94a3b840",
      "scrollbarSlider.hoverBackground": "#64748b66",
      "editorWidget.background": "#f8fafc",
      "editorSuggestWidget.background": "#f8fafc",
    },
  });
}

/* ---------- Shared chrome ---------- */


const CodeModal = ({ code, language, onClose, onCopy, copied, editorTheme }) => {
  const [modalFontSize, handleModalEditorMount] = useEditorZoom(15);

  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div className="ci-fullscreen-overlay">
      <div className="ci-fullscreen__header">
        <span className="ci-fullscreen__title">Optimized Code</span>
        <div className="ci-optimized-code__actions">
          <button type="button" className="ci-copy-btn" onClick={onCopy}>
            {copied ? "✓ Copied" : "Copy"}
          </button>
          <button type="button" className="ci-icon-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="ci-fullscreen__body">
        <Editor
          height="100%"
          language={language}
          value={code}
          theme={editorTheme}
          beforeMount={registerTheme}
          onMount={handleModalEditorMount}
          options={{
            readOnly: true,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: modalFontSize,
            lineHeight: 24,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            padding: { top: 20, bottom: 20 },
            automaticLayout: true,
            fontLigatures: true,
            domReadOnly: true,
            contextmenu: false,
          }}
        />
      </div>
    </div>,
    document.body
  );
};

const OptimizedCodeBlock = ({ code, language, editorTheme }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [blockFontSize, handleBlockEditorMount] = useEditorZoom(13);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard permission denied — silently ignore */
    }
  };

  const lineCount = code.split("\n").length;
  const editorHeight = Math.min(Math.max(lineCount * 20 + 20, 100), 400);

  return (
    <>
      <div className="ci-optimized-code">
        <div className="ci-optimized-code__header">
          <span className="ci-optimized-code__label">Suggested rewrite</span>
          <div className="ci-optimized-code__actions">
            <button
              type="button"
              className="ci-icon-btn"
              onClick={() => setExpanded(true)}
              aria-label="Expand code"
              title="Expand"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="ci-copy-btn" onClick={handleCopy}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>
        <Editor
          height={`${editorHeight}px`}
          language={language}
          value={code}
          theme={editorTheme}
          beforeMount={registerTheme}
          onMount={handleBlockEditorMount}
          options={{
            readOnly: true,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: blockFontSize,
            lineHeight: 20,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: "none",
            automaticLayout: true,
            fontLigatures: true,
            domReadOnly: true,
            contextmenu: false,
            overviewRulerLanes: 0,
          }}
        />
      </div>

      {expanded && (
        <CodeModal
          code={code}
          language={language}
          onClose={() => setExpanded(false)}
          onCopy={handleCopy}
          copied={copied}
          editorTheme={editorTheme}
        />
      )}
    </>
  );
};

/* ---------- Small UI pieces ---------- */

const badgeTone = (value) => {
  if (value === "O(1)" || value === "O(log n)") return "success";
  if (value === "O(n)" || value === "O(n log n)") return "warning";
  if (value === "Unknown") return "warning";
  return "error";
};

const ResultCard = ({ icon, title, children, delay = 0, tone }) => (
  <section className={`ci-result-card${tone ? ` ci-result-card--${tone}` : ""}`} style={{ animationDelay: `${delay}ms` }}>
    <header className="ci-result-card__head">
      <span className="ci-result-card__icon">{icon}</span>
      <h3 className="ci-result-card__title">{title}</h3>
    </header>
    <div className="ci-result-card__body">{children}</div>
  </section>
);

const ComplexityBadge = ({ value }) => (
  <div className={`ci-complexity-badge ci-complexity-badge--${badgeTone(value)}`}>{value}</div>
);

const EmptyState = () => (
  <div className="ci-empty-state">
    <div className="ci-empty-state__icon">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
    <h3 className="ci-empty-state__title">No analysis yet</h3>
    <p className="ci-empty-state__desc">Paste or write code in the editor, then click Analyze to see complexity, errors, and suggestions here.</p>
  </div>
);

const LoadingState = () => (
  <div className="ci-loading-state">
    <span className="ci-spinner" aria-hidden="true" />
    <p>Analyzing your code&hellip;</p>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="ci-empty-state ci-empty-state--error">
    <div className="ci-empty-state__icon ci-empty-state__icon--error">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 3.5l9.5 16.5H2.5L12 3.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12 10v4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="17" r="0.9" fill="currentColor" />
      </svg>
    </div>
    <h3 className="ci-empty-state__title">Couldn't reach the analysis server</h3>
    <p className="ci-empty-state__desc">{message}</p>
    <button type="button" className="ci-btn ci-btn--ghost ci-btn--sm" onClick={onRetry}>
      Try again
    </button>
  </div>
);

/* ---------- History panel ---------- */

const HistoryPanel = ({ entries, onClose, onLoad, onDelete, onClearAll }) => {
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2, 6, 23, 0.6)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(380px, 92vw)",
          height: "100%",
          background: "#131c31",
          borderLeft: "1px solid #253356",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-12px 0 40px rgba(0,0,0,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 18px",
            borderBottom: "1px solid #253356",
          }}
        >
          <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 15 }}>
            History{entries.length > 0 ? ` (${entries.length})` : ""}
          </span>
          <button type="button" className="ci-icon-btn" onClick={onClose} aria-label="Close history">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
          {entries.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 13.5, padding: "24px 8px", textAlign: "center" }}>
              Nothing analyzed yet. Past runs will show up here automatically.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    border: "1px solid #253356",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "#161f36",
                    cursor: "pointer",
                  }}
                  onClick={() => onLoad(entry)}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: "#93c5fd", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
                      {entry.langMeta?.label ?? "Auto"}
                    </span>
                    <button
                      type="button"
                      aria-label="Delete entry"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(entry.id);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        fontSize: 16,
                        lineHeight: 1,
                        padding: 2,
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      color: "#cbd5e1",
                      whiteSpace: "pre-wrap",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {entry.code}
                  </pre>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ color: "#475569", fontSize: 11 }}>{formatTimestamp(entry.timestamp)}</span>
                    {entry.results?.time && <ComplexityBadge value={entry.results.time} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {entries.length > 0 && (
          <div style={{ padding: "12px 18px", borderTop: "1px solid #253356" }}>
            <button type="button" className="ci-btn ci-btn--ghost ci-btn--sm" style={{ width: "100%" }} onClick={onClearAll}>
              Clear all history
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

/* ---------- Page ---------- */

export default function AnalyzePage() {
  const [code, setCode] = useState("");
  // Purely cosmetic — drives Monaco syntax highlighting + the fake
  // filename/extension in the editor titlebar. Starts as plain text and
  // switches to whatever the backend detects once analysis comes back.
  const [langMeta, setLangMeta] = useState(resolveLanguageMeta(null));
  // const [editorTheme, setEditorTheme] = useState("ciDark");
  const { isDark } = useTheme();
  const editorTheme = isDark ? "ciDark" : "ciLight";
  // Zoom for the main code editor — ctrl/cmd+scroll, trackpad pinch, or
  // touch-screen pinch. Same hook powers the optimized-code editors below.
  const [editorFontSize, handleEditorMount] = useEditorZoom(14);
  const [history, setHistory] = useState(() => loadHistory());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Picks up a "Load Example" hand-off from the Examples page.
  useEffect(() => {
    const pending = window.sessionStorage.getItem("ci-pending-example");
    if (!pending) return;
    try {
      const { code: pendingCode, language: pendingLanguage } = JSON.parse(pending);
      if (pendingCode) setCode(pendingCode);
      if (pendingLanguage) setLangMeta(resolveLanguageMeta(pendingLanguage));
      setResults(null);
      setStatus("idle");
    } catch {
      /* malformed payload — ignore and keep defaults */
    } finally {
      window.sessionStorage.removeItem("ci-pending-example");
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!code.trim() || status === 'loading') return;
    setStatus("loading");
    setResults(null);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        const retryAfter = res.headers.get("retry-after");
        const waitMsg = retryAfter ? ` Try again in ${retryAfter}s.` : " Please wait a moment and try again.";
        throw new Error((body.error || "Rate limit reached.") + waitMsg);
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      const resolvedMeta = resolveLanguageMeta(data.language);

      // Map backend JSON shape to what the UI cards expect
      const builtResults = {
        detectedLanguage: data.language ?? "Unknown",
        time: data.timeComplexity ?? "Unknown",
        space: data.spaceComplexity ?? "Unknown",
        errors: data.syntaxErrors ?? [],
        suggestions: data.optimizationSuggestions ?? [],
        explanation: data.explanation ?? [],
        confidence: data.confidence ?? "",
        optimizedCode: data.optimizedCode ?? "",
        recursion: false,
      };

      setResults(builtResults);
      setLangMeta(resolvedMeta);
      setStatus("done");

      setHistory(
        pushHistoryEntry({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          code,
          langMeta: resolvedMeta,
          results: builtResults,
        })
      );
    } catch (err) {
      setErrorMsg(
        err.message === "Failed to fetch"
          ? "Make sure the backend is running (cd backend-node && node server.js) at " + API_BASE_URL
          : err.message
      );
      setStatus("error");
    }
  }, [code]);

  // Ctrl+Enter (or Cmd+Enter on Mac) triggers Analyze from anywhere on the page,
// including while focus is inside the Monaco editor.
useEffect(() => {
  const handleKeyDown = (e) => {
    const isEnter = e.key === "Enter";
    const isModifierPressed = e.ctrlKey || e.metaKey;
    if (isEnter && isModifierPressed) {
      e.preventDefault();
      handleAnalyze();
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [handleAnalyze]);

  const handleClear = () => {
    setCode("");
    setResults(null);
    setStatus("idle");
    setErrorMsg("");
    setLangMeta(resolveLanguageMeta(null));
  };

  const handleLoadHistoryEntry = (entry) => {
    setCode(entry.code);
    setLangMeta(entry.langMeta ?? resolveLanguageMeta(null));
    setResults(entry.results);
    setStatus(entry.results ? "done" : "idle");
    setErrorMsg("");
    setHistoryOpen(false);
  };

  const handleDeleteHistoryEntry = (id) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      persistHistory(next);
      return next;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    persistHistory([]);
  };

  return (
    <div className="ci-page">
      <NavBar />

      <main className="ci-analyze">
        <div className="ci-analyze__toolbar">
          <div className="ci-analyze__toolbar-left">
            <span className="ci-eyebrow">Analyze</span>
            <h1 className="ci-analyze__heading">Paste your code, get instant insight</h1>
          </div>

          <div className="ci-analyze__controls">
            <button type="button" className="ci-btn ci-btn--ghost ci-btn--sm" onClick={() => setHistoryOpen(true)}>
              History{history.length > 0 ? ` (${history.length})` : ""}
            </button>
            <button type="button" className="ci-btn ci-btn--ghost ci-btn--sm" onClick={handleClear}>
              Clear
            </button>
            <button
              type="button"
              className="ci-btn ci-btn--primary ci-btn--sm"
              onClick={handleAnalyze}
              disabled={status === "loading" || !code.trim()}
            >
              {status === "loading" ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </div>

        <div className="ci-analyze__grid">
          {/* LEFT — editor */}
          <div className="ci-editor-window">
            <div className="ci-editor-window__titlebar">
              <span className="ci-dot ci-dot--red" />
              <span className="ci-dot ci-dot--yellow" />
              <span className="ci-dot ci-dot--green" />
              <span className="ci-editor-window__filename">main.{langMeta.ext}</span>
              <span className="ci-editor-window__lang">{langMeta.label}</span>
              <button
                type="button"
                className="ci-icon-btn"
                onClick={() => setEditorTheme((t) => (t === "ciDark" ? "ciLight" : "ciDark"))}
                aria-label={editorTheme === "ciDark" ? "Switch to light theme" : "Switch to dark theme"}
                title={editorTheme === "ciDark" ? "Light mode" : "Dark mode"}
                style={{ marginLeft: "auto" }}
              >
                {editorTheme === "ciDark" ? (
                  <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
                      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
            <div className="ci-editor-window__body">
              <Editor
                height="100%"
                language={langMeta.id}
                value={code}
                theme={editorTheme}
                beforeMount={registerTheme}
                onMount={handleEditorMount}
                onChange={(value) => setCode(value ?? "")}
                options={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: editorFontSize,
                  lineHeight: 24,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  padding: { top: 18, bottom: 18 },
                  renderLineHighlight: "gutter",
                  automaticLayout: true,
                  fontLigatures: true,
                }}
              />
            </div>
          </div>

          {/* RIGHT — analysis panel */}
          <div className="ci-results">
            {status === "idle" && <EmptyState />}
            {status === "loading" && <LoadingState />}
            {status === "error" && <ErrorState message={errorMsg} onRetry={handleAnalyze} />}

            {status === "done" && results && (
              <div className="ci-results__list">
                <ResultCard
                  delay={0}
                  title="Detected Language"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M8 6L3 12l5 6M16 6l5 6-5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  <span className="ci-detected-lang">{results.detectedLanguage}</span>
                </ResultCard>

                <ResultCard
                  delay={60}
                  title="Time Complexity"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  }
                >
                  <ComplexityBadge value={results.time} />
                </ResultCard>

                <ResultCard
                  delay={120}
                  title="Space Complexity"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  <ComplexityBadge value={results.space} />
                </ResultCard>

                <ResultCard
                  delay={180}
                  title="Syntax Errors"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M12 3.5l9.5 16.5H2.5L12 3.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                      <path d="M12 10v4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
                    </svg>
                  }
                  tone={results.errors.length ? "error" : "success"}
                >
                  {results.errors.length === 0 ? (
                    <p className="ci-syntax-ok">✓ No syntax errors detected</p>
                  ) : (
                    <ul className="ci-syntax-errors">
                      {results.errors.map((err, i) => (
                        <li key={i}>
                          {typeof err === "string"
                            ? err
                            : `${err.line ? `Line ${err.line}: ` : ""}${err.message || JSON.stringify(err)}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </ResultCard>

                <ResultCard
                  delay={240}
                  title="Optimization Suggestions"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M12 3l1.8 5.6L19 10.4l-5.2 1.8L12 18l-1.8-5.8L5 10.4l5.2-1.8L12 3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  <div className="ci-suggestion-cards">
                    {results.suggestions.map((s, i) => {
                      const text = typeof s === "string" ? s : JSON.stringify(s);
                      const isWarning = /inefficient|astronomically|avoid|flaw|high time|O\(n\^[4-9]\)/i.test(text);

                      // Split "**Title**: rest of text" into a bold heading + body, if present
                      const match = text.match(/^\*\*(.+?)\*\*:?\s*(.*)$/s);
                      const heading = match ? match[1] : null;
                      const body = match ? match[2] : text;

                      return (
                        <div
                          key={i}
                          className={`ci-suggestion-card${isWarning ? " ci-suggestion-card--warning" : ""}`}
                        >
                          <span className="ci-suggestion-card__badge">{isWarning ? "⚠" : i + 1}</span>
                          <div className="ci-suggestion-card__content">
                            {heading && <p className="ci-suggestion-card__heading">{heading}</p>}
                            <p className="ci-suggestion-card__body">{body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ResultCard>

                <ResultCard
                  delay={300}
                  title="AI Explanation"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 5h16v11H9l-5 4V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  <div className="ci-ai-message__bubble">
                    {Array.isArray(results.explanation) ? (
                      <ul className="ci-ai-message__list">
                        {results.explanation.map((point, i) => (
                          <li key={i}>{typeof point === "string" ? point : JSON.stringify(point)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="ci-ai-message__text">{results.explanation}</p>
                    )}
                    {results.confidence && (
                      <span className={`ci-ai-message__confidence ci-ai-message__confidence--${results.confidence}`}>
                        {results.confidence === "high" && "● High confidence"}
                        {results.confidence === "medium" && "● Medium confidence"}
                        {results.confidence === "low" && "● Low confidence"}
                      </span>
                    )}
                  </div>
                </ResultCard>

                {results.optimizedCode && (
                  <ResultCard
                    delay={420}
                    title="Optimized Code"
                    icon={
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    }
                  >
                    <OptimizedCodeBlock code={results.optimizedCode} language={langMeta.id} editorTheme={editorTheme} />
                  </ResultCard>
                )}

                <ResultCard
                  delay={360}
                  title="Performance Comparison"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  <div className="ci-compare">
                    <div className="ci-compare__row">
                      <span className="ci-compare__label">Current</span>
                      <div className="ci-compare__track">
                        <div
                          className="ci-compare__fill ci-compare__fill--current"
                          style={{ width: `${COMPLEXITY_WEIGHT[results.time] ?? 50}%` }}
                        />
                      </div>
                      <span className="ci-compare__value">{results.time}</span>
                    </div>
                    <p className="ci-compare__hint">
                      A precise "optimized" projection needs the actual rewritten algorithm — see the note above.
                      This bar reflects the current code's real, parser-verified complexity.
                    </p>
                  </div>
                </ResultCard>
              </div>
            )}
          </div>
        </div>
      </main>

      {historyOpen && (
        <HistoryPanel
          entries={history}
          onClose={() => setHistoryOpen(false)}
          onLoad={handleLoadHistoryEntry}
          onDelete={handleDeleteHistoryEntry}
          onClearAll={handleClearHistory}
        />
      )}
    <Footer />
    </div>
  );
}
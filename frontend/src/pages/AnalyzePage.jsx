import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Editor from "@monaco-editor/react";
import Footer from '../components/Footer';
import { useTheme } from "../context/ThemeContext"; // adjust path
import NavBar from "../components/Header";
import "./HomePage.css";
import "./AnalyzePage.css";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://codeinsight-ai-dnou.onrender.com";

/* ==========================================================================
   This page calls the deployed Node/Express backend instead of guessing
   client-side. Override VITE_API_BASE_URL when using a different backend.

   Users can paste code, upload a single file, or choose a language override.
   When a file is uploaded, the extension is detected automatically; otherwise,
   the backend still detects the language and reports it back in the results.
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
const SUPPORTED_UPLOAD_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".cpp",
  ".cc",
  ".cxx",
  ".c",
];
const ANALYSIS_MODES = {
  interview: { label: "Interview / DSA" },
  clean: { label: "Clean Code" },
  security: { label: "Bug & Security" },
};

function resolveLanguageMeta(name) {
  if (!name) return { id: "auto", ...DEFAULT_META };
  const id = String(name).trim().toLowerCase();
  if (id === "auto") return { id: "auto", ...DEFAULT_META };
  if (LANGUAGE_META[id]) return { id, ...LANGUAGE_META[id] };
  return { id: "auto", ...DEFAULT_META };
}

function resolveLanguageMetaFromFilename(filename) {
  if (!filename) return resolveLanguageMeta(null);

  const match = filename.match(/\.([A-Za-z0-9]+)$/);
  if (!match) return resolveLanguageMeta(null);

  const ext = match[1].toLowerCase();
  const resolved = Object.entries(LANGUAGE_META).find(([, meta]) => meta.ext === ext);

  if (resolved) {
    const [id] = resolved;
    return { id, ...LANGUAGE_META[id] };
  }

  const extMap = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    java: "java",
    cpp: "cpp",
    cxx: "cpp",
    cc: "cpp",
    c: "c",
  };

  const mapped = extMap[ext];
  if (mapped && LANGUAGE_META[mapped]) return { id: mapped, ...LANGUAGE_META[mapped] };
  return resolveLanguageMeta(null);
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

const COMPLEXITY_CURVES = [
  { key: "O(1)", label: "O(1)", color: "#22c55e", fn: () => 0.14 },
  { key: "O(log n)", label: "O(log N)", color: "#38bdf8", fn: (x) => 0.14 + Math.log2(x + 1) * 0.08 },
  { key: "O(n)", label: "O(N)", color: "#facc15", fn: (x) => 0.14 + x * 0.42 },
  { key: "O(n²)", label: "O(N²)", color: "#ef4444", fn: (x) => 0.14 + x * x * 0.42 },
];

function normalizeComplexity(value) {
  const normalized = String(value || "").toLowerCase().replace(/\s/g, "");
  if (/o\(1\)/.test(normalized)) return "O(1)";
  if (/o\(logn\)/.test(normalized)) return "O(log n)";
  if (/o\(nlogn\)/.test(normalized)) return "O(n log n)";
  if (/o\(n\^?2\)|o\(n²\)/.test(normalized)) return "O(n²)";
  if (/o\(n\)/.test(normalized)) return "O(n)";
  return "Unknown";
}

/* ---------- History (localStorage) ---------- */

const HISTORY_KEY = "ci-analysis-history";
const HISTORY_LIMIT = 10;

function loadHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_LIMIT) : [];
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

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toBase64(value) {
  return btoa(
    encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return decodeURIComponent(
    Array.from(atob(padded), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")
  );
}

async function encodeSharePayload(value) {
  if (typeof CompressionStream === "undefined") return `raw.${toBase64(value)}`;
  const compressed = await new Response(
    new Blob([new TextEncoder().encode(value)]).stream().pipeThrough(new CompressionStream("gzip"))
  ).arrayBuffer();
  const binary = String.fromCharCode(...new Uint8Array(compressed));
  return `gz.${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

async function decodeSharePayload(token) {
  const [format, encoded] = token.split(".", 2);
  if (format === "raw") return fromBase64(encoded);
  if (format !== "gz" || typeof DecompressionStream === "undefined") {
    throw new Error("Unsupported share link format");
  }
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  const binary = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  const decompressed = await new Response(
    new Blob([binary]).stream().pipeThrough(new DecompressionStream("gzip"))
  ).arrayBuffer();
  return new TextDecoder().decode(decompressed);
}

function buildMarkdownReport(code, results, mode) {
  const list = (items) =>
    (items?.length ? items.map((item) => `- ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n") : "- None");

  return `# CodeInsight AI Analysis

**Analysis mode:** ${ANALYSIS_MODES[mode]?.label || mode}
**Detected language:** ${results.detectedLanguage}
**Time complexity:** ${results.time}
**Space complexity:** ${results.space}

## Explanation
${list(results.explanation)}

## Syntax errors
${list(results.errors)}

## Optimization suggestions
${list(results.suggestions)}

## Original code
\`\`\`${results.detectedLanguage.toLowerCase()}
${code}
\`\`\`

## Optimized code
\`\`\`${results.detectedLanguage.toLowerCase()}
${results.optimizedCode || "No optimized rewrite was suggested."}
\`\`\`
`;
}

function buildPrintableReport(code, results, mode) {
  return buildMarkdownReport(code, results, mode)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```[^\n]*\n/g, "<pre>")
    .replace(/```/g, "</pre>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^\*\*(.*?)\*\*: (.*)$/gm, "<p><strong>$1:</strong> $2</p>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "<br />");
}

const ReportPreview = ({ code, results, mode, hotspotMap, onClose, onExportPdf, onExportMarkdown }) => {
  const documentRef = useRef(null);

  useEffect(() => {
    const handleEsc = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div className="ci-report-preview-overlay" role="dialog" aria-modal="true" aria-label="Analysis report preview">
      <div className="ci-report-preview">
        <header className="ci-report-preview__header">
          <div>
            <span className="ci-eyebrow">Export preview</span>
            <h2>Review your analysis report</h2>
            <p>Check the report before printing or downloading it.</p>
          </div>
          <button type="button" className="ci-icon-btn" onClick={onClose} aria-label="Close report preview">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="ci-report-preview__toolbar">
          <span>{ANALYSIS_MODES[mode]?.label || mode} · {results.detectedLanguage}</span>
          <div>
            <button type="button" className="ci-btn ci-btn--ghost ci-btn--sm" onClick={onExportMarkdown}>Download Markdown</button>
            <button
              type="button"
              className="ci-btn ci-btn--primary ci-btn--sm"
              onClick={() => onExportPdf(documentRef.current)}
            >
              Print / Save PDF
            </button>
          </div>
        </div>
        <article ref={documentRef} className="ci-report-preview__document">
          <div className="ci-report-preview__hero">
            <span className="ci-eyebrow">CodeInsight AI</span>
            <h1>Analysis report</h1>
            <p>
              {ANALYSIS_MODES[mode]?.label || mode} analysis for {results.detectedLanguage}.
            </p>
          </div>

          <div className="ci-report-preview__metrics">
            <div className="ci-report-preview__metric">
              <span>Language</span>
              <strong>{results.detectedLanguage}</strong>
            </div>
            <div className="ci-report-preview__metric">
              <span>Time complexity</span>
              <strong className="ci-report-preview__metric--blue">{results.time}</strong>
            </div>
            <div className="ci-report-preview__metric">
              <span>Space complexity</span>
              <strong className="ci-report-preview__metric--purple">{results.space}</strong>
            </div>
            <div className="ci-report-preview__metric">
              <span>Syntax status</span>
              <strong className={results.errors.length ? "ci-report-preview__metric--red" : "ci-report-preview__metric--green"}>
                {results.errors.length ? `${results.errors.length} issue(s)` : "No issues"}
              </strong>
            </div>
          </div>

          <section className="ci-report-preview__visual">
            <h2>Complexity at a glance</h2>
            <ComplexityGraph complexity={results.time} />
          </section>

          <details className="ci-report-preview__section" open>
            <summary>Explanation and confidence</summary>
            <ul>
              {(Array.isArray(results.explanation) ? results.explanation : [results.explanation]).map((item, index) => (
                <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
              ))}
            </ul>
            {results.confidence && <span className="ci-report-preview__confidence">{results.confidence} confidence</span>}
          </details>

          <details className="ci-report-preview__section" open>
            <summary>Syntax and security findings ({results.errors.length})</summary>
            {results.errors.length ? (
              <ul>
                {results.errors.map((item, index) => (
                  <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
                ))}
              </ul>
            ) : <p>No syntax or security findings were returned.</p>}
          </details>

          <details className="ci-report-preview__section" open>
            <summary>Optimization suggestions ({results.suggestions.length})</summary>
            {results.suggestions.length ? (
              <ul>
                {results.suggestions.map((item, index) => (
                  <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
                ))}
              </ul>
            ) : <p>No optimization suggestions were returned.</p>}
          </details>

          {hotspotMap?.length > 0 && (
            <details className="ci-report-preview__section" open>
              <summary>Complexity hotspots ({hotspotMap.length})</summary>
              <ul>
                {hotspotMap.map((item) => (
                  <li key={item.line}>
                    <strong>Line {item.line}:</strong> {item.text}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {Array.isArray(results.testCases) && results.testCases.length > 0 && (
            <details className="ci-report-preview__section" open>
              <summary>Suggested test cases ({results.testCases.length})</summary>
              <ul>
                {results.testCases.map((item, index) => (
                  <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
                ))}
              </ul>
              <p className="ci-report-preview__muted">
                Use the interactive test runner in the app to enter values and verify the implementation yourself.
              </p>
            </details>
          )}

          <details className="ci-report-preview__section" open>
            <summary>Original code</summary>
            <pre className="ci-report-preview__code">{code}</pre>
          </details>

          <details className="ci-report-preview__section" open>
            <summary>Optimized code</summary>
            <pre className="ci-report-preview__code">{results.optimizedCode || "No optimized rewrite was suggested."}</pre>
          </details>

          <div className="ci-report-preview__print-note">
            The controls above are interactive in preview mode. Save as PDF when ready.
          </div>
        </article>
      </div>
    </div>,
    document.body
  );
};

function buildHotspotMap(code) {
  const lines = (code || "").split(/\r?\n/);
  if (!lines.length || !code.trim()) return [];

  let activeDepth = 0;
  return lines
    .map((line, index) => {
      const plain = line.trim();
      if (!plain) return null;

      const loopMatches = (plain.match(/\b(for|while|forEach|map|filter|reduce)\b/gi) || []).length;
      const recursionMatches = (plain.match(/\breturn\s+[A-Za-z_$][\w$]*\s*\(|[A-Za-z_$][\w$]*\s*\([^)]*\)/g) || []).length;
      const branchMatches = (plain.match(/\b(if|else if|switch)\b/gi) || []).length;

      let score = 0;
      if (loopMatches) score += loopMatches * 2;
      if (branchMatches) score += 1;
      if (recursionMatches) score += 2;
      if (plain.includes("&&") || plain.includes("||")) score += 1;

      // approximate nesting depth by counting loop starts before this line
      const loopCountBefore = lines
        .slice(0, index)
        .reduce((count, prevLine) => count + ((prevLine.match(/\b(for|while|forEach|map|filter|reduce)\b/gi) || []).length > 0 ? 1 : 0), 0);
      if (loopCountBefore > 0) activeDepth = Math.max(activeDepth, loopCountBefore);
      if (loopMatches > 0) score += Math.min(loopCountBefore, 3);

      if (score <= 0) return null;
      const tone = score >= 5 ? "danger" : score >= 3 ? "warning" : "info";

      return { line: index + 1, score, text: plain, tone };
    })
    .filter(Boolean)
    .slice(0, 8);
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

const ComparisonModal = ({ originalCode, optimizedCode, language, editorTheme, onClose }) => {
  const [originalFontSize, handleOriginalMount] = useEditorZoom(15);
  const [optimizedFontSize, handleOptimizedMount] = useEditorZoom(15);

  useEffect(() => {
    const handleEsc = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const editorOptions = (fontSize) => ({
    readOnly: true,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize,
    lineHeight: 24,
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    padding: { top: 20, bottom: 20 },
    automaticLayout: true,
    fontLigatures: true,
    domReadOnly: true,
    contextmenu: false,
  });

  return createPortal(
    <div className="ci-fullscreen-overlay">
      <div className="ci-fullscreen__header">
        <span className="ci-fullscreen__title">Code Comparison</span>
        <button type="button" className="ci-icon-btn" onClick={onClose} aria-label="Close comparison">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="ci-fullscreen__body ci-comparison-fullscreen__body">
        <div className="ci-comparison-fullscreen__pane">
          <div className="ci-comparison-fullscreen__label">Original</div>
          <Editor
            height="100%"
            language={language}
            value={originalCode}
            theme={editorTheme}
            beforeMount={registerTheme}
            onMount={handleOriginalMount}
            options={editorOptions(originalFontSize)}
          />
        </div>
        <div className="ci-comparison-fullscreen__pane">
          <div className="ci-comparison-fullscreen__label ci-comparison-fullscreen__label--optimized">
            Optimized
          </div>
          <Editor
            height="100%"
            language={language}
            value={optimizedCode}
            theme={editorTheme}
            beforeMount={registerTheme}
            onMount={handleOptimizedMount}
            options={editorOptions(optimizedFontSize)}
          />
        </div>
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

const SplitCodeComparison = ({ originalCode, optimizedCode, language, editorTheme }) => {
  const [originalFontSize, handleOriginalMount] = useEditorZoom(12);
  const [optimizedFontSize, handleOptimizedMount] = useEditorZoom(12);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className="ci-comparison-grid">
        <div className="ci-comparison-pane">
          <div className="ci-comparison-pane__header">
            <span>Original</span>
            <button
              type="button"
              className="ci-icon-btn"
              onClick={() => setExpanded(true)}
              aria-label="Expand code comparison"
              title="Expand"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <Editor
            height="320px"
            language={language}
            value={originalCode}
            theme={editorTheme}
            beforeMount={registerTheme}
            onMount={handleOriginalMount}
            options={{
              readOnly: true,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: originalFontSize,
              lineHeight: 20,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 12, bottom: 12 },
              automaticLayout: true,
              fontLigatures: true,
              contextmenu: false,
            }}
          />
        </div>

        <div className="ci-comparison-pane">
          <div className="ci-comparison-pane__header ci-comparison-pane__header--optimized">Optimized</div>
          <Editor
            height="320px"
            language={language}
            value={optimizedCode}
            theme={editorTheme}
            beforeMount={registerTheme}
            onMount={handleOptimizedMount}
            options={{
              readOnly: true,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: optimizedFontSize,
              lineHeight: 20,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 12, bottom: 12 },
              automaticLayout: true,
              fontLigatures: true,
              contextmenu: false,
            }}
          />
        </div>
      </div>

      {expanded && (
        <ComparisonModal
          originalCode={originalCode}
          optimizedCode={optimizedCode}
          language={language}
          editorTheme={editorTheme}
          onClose={() => setExpanded(false)}
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

function isBrowserRunnableLanguage(language) {
  return ["javascript", "js", "jsx", "typescript", "ts", "tsx"].includes(
    String(language || "").trim().toLowerCase()
  );
}

const ComplexityGraph = ({ complexity }) => {
  const activeKey = normalizeComplexity(complexity);
  const width = 520;
  const height = 230;
  const padding = { top: 18, right: 18, bottom: 34, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const point = (x, y) =>
    `${padding.left + x * plotWidth},${padding.top + plotHeight - Math.min(y, 1) * plotHeight}`;
  const pathFor = (fn) =>
    Array.from({ length: 31 }, (_, index) => {
      const x = index / 30;
      return `${index === 0 ? "M" : "L"} ${point(x, fn(x))}`;
    }).join(" ");

  return (
    <div className="ci-complexity-graph">
      <div className="ci-complexity-graph__legend">
        {COMPLEXITY_CURVES.map((curve) => (
          <span key={curve.key} className={activeKey === curve.key ? "ci-complexity-graph__legend--active" : ""}>
            <i style={{ backgroundColor: curve.color }} />
            {curve.label}
          </span>
        ))}
        <strong>Snippet: {complexity}</strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Complexity growth graph">
        {[0, 0.25, 0.5, 0.75, 1].map((level) => (
          <line
            key={level}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight - level * plotHeight}
            y2={padding.top + plotHeight - level * plotHeight}
            className="ci-complexity-graph__gridline"
          />
        ))}
        <line x1={padding.left} x2={padding.left} y1={padding.top} y2={height - padding.bottom} className="ci-complexity-graph__axis" />
        <line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} className="ci-complexity-graph__axis" />
        {COMPLEXITY_CURVES.map((curve) => (
          <path
            key={curve.key}
            d={pathFor(curve.fn)}
            fill="none"
            stroke={curve.color}
            className={`ci-complexity-graph__curve${activeKey === curve.key ? " ci-complexity-graph__curve--active" : ""}`}
          />
        ))}
        <text x={padding.left} y={height - 10} className="ci-complexity-graph__label">Input size (N)</text>
        <text x="14" y={padding.top + 8} className="ci-complexity-graph__label" transform={`rotate(-90 14 ${padding.top + 8})`}>Operations</text>
      </svg>
    </div>
  );
};

const TestCaseGenerator = ({ testCases, language, code }) => {
  const [input, setInput] = useState("");
  const [expected, setExpected] = useState("");
  const [output, setOutput] = useState("");
  const [runState, setRunState] = useState("idle");
  const browserRunnable = isBrowserRunnableLanguage(language);

  const runJavaScriptTest = () => {
    if (!browserRunnable) {
      setRunState("error");
      setOutput(
        `Browser execution is currently supported for JavaScript/TypeScript only. ` +
        `${language || "This"} code uses a different runtime.`
      );
      return;
    }

    setRunState("running");
    setOutput("");

    const workerSource = `
      self.onmessage = ({ data }) => {
        try {
          const input = JSON.parse(data.input);
          const module = { exports: {} };
          const exports = module.exports;
          const source = data.code;
          new Function("module", "exports", source + "\\n; if (typeof solve === 'function') module.exports = solve;")(module, exports);
          const candidate = module.exports.default || module.exports.solve || module.exports;
          const fn = typeof candidate === "function"
            ? candidate
            : typeof self.solve === "function" ? self.solve : null;
          if (!fn) throw new Error("Export a function or define solve(input) to run this test.");
          const result = fn(input);
          self.postMessage({ ok: true, output: JSON.stringify(result) });
        } catch (error) {
          self.postMessage({ ok: false, error: error.message || String(error) });
        }
      };
    `;
    const worker = new Worker(URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" })));
    const cleanup = () => worker.terminate();
    const timer = window.setTimeout(() => {
      cleanup();
      setRunState("error");
      setOutput("Execution timed out after 2 seconds.");
    }, 2000);

    worker.onmessage = ({ data }) => {
      window.clearTimeout(timer);
      cleanup();
      setRunState(data.ok ? "success" : "error");
      setOutput(data.ok ? data.output : data.error);
    };
    worker.postMessage({ code, input });
  };

  const runJavaTest = async () => {
    setRunState("running");
    setOutput("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/run-java`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, input }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Java runner returned ${response.status}`);
      setRunState("success");
      setOutput(data.output || "(no output)");
    } catch (error) {
      setRunState("error");
      setOutput(error.message || "Unable to run Java code.");
    }
  };

  const canRun = browserRunnable || String(language || "").toLowerCase() === "java";

  return (
    <div className="ci-test-runner">
      <p className="ci-test-runner__hint">
        Currently available in JavaScript and TypeScript.
      </p>
      <label className="ci-test-runner__label" htmlFor="test-input">Test input</label>
      <textarea
        id="test-input"
        className="ci-test-runner__textarea"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder='Example: [1, 2, 3] or {"value": 10}'
        spellCheck="false"
      />
      <label className="ci-test-runner__label" htmlFor="expected-output">Expected output (optional)</label>
      <input
        id="expected-output"
        className="ci-test-runner__input"
        value={expected}
        onChange={(event) => setExpected(event.target.value)}
        placeholder="Example: 6"
      />
      <div className="ci-test-runner__actions">
        <button
          type="button"
          className="ci-btn ci-btn--primary ci-btn--sm"
          onClick={browserRunnable ? runJavaScriptTest : runJavaTest}
          disabled={!input.trim() || runState === "running" || !canRun}
        >
          {!canRun ? "Runner unavailable" : runState === "running" ? "Running…" : "Run test"}
        </button>
        {runState === "success" && expected.trim() && (
          <span className={output === expected.trim() ? "ci-test-runner__pass" : "ci-test-runner__fail"}>
            {output === expected.trim() ? "✓ Passed" : "✕ Output differs"}
          </span>
        )}
      </div>
      {output && (
        <pre className={`ci-test-runner__output ci-test-runner__output--${runState}`}>
          {output}
        </pre>
      )}
      {!browserRunnable && (
        <p className="ci-test-runner__hint">
          {String(language || "").toLowerCase() === "java"
            ? "Java runs through your local backend only. Set ALLOW_LOCAL_CODE_EXECUTION=true and restart it."
            : `Direct execution is currently unavailable for ${language || "this language"}.`}
        </p>
      )}
      {Array.isArray(testCases) && testCases.length > 0 && (
        <details className="ci-test-runner__suggestions">
          <summary>Show AI edge-case suggestions</summary>
          {testCases.map((item, index) => (
            <button
              type="button"
              key={index}
              onClick={() => setInput(typeof item === "string" ? item : item.input || "")}
            >
              {typeof item === "string" ? item : item.input || `Suggested case ${index + 1}`}
            </button>
          ))}
        </details>
      )}
    </div>
  );
};

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
  const fileInputRef = useRef(null);
  const [languageOverride, setLanguageOverride] = useState("auto");
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("main.txt");
  // Purely cosmetic — drives Monaco syntax highlighting + the fake
  // filename/extension in the editor titlebar. Starts as plain text and
  // switches to whatever the backend detects once analysis comes back.
  const [langMeta, setLangMeta] = useState(resolveLanguageMeta(null));
  const { isDark } = useTheme();
  const [editorTheme, setEditorTheme] = useState(isDark ? "ciDark" : "ciLight");

  useEffect(() => {
    setEditorTheme(isDark ? "ciDark" : "ciLight");
  }, [isDark]);
  // Zoom for the main code editor — ctrl/cmd+scroll, trackpad pinch, or
  // touch-screen pinch. Same hook powers the optimized-code editors below.
  const [editorFontSize, handleEditorMount] = useEditorZoom(14);
  const [history, setHistory] = useState(() => loadHistory());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [analysisMode, setAnalysisMode] = useState("interview");
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [notice, setNotice] = useState("");
  const sharedPendingRef = useRef(false);
  const hotspotMap = buildHotspotMap(code);

  useEffect(() => {
    const sharedValue = new URLSearchParams(window.location.search).get("share");
    if (!sharedValue) return;

    (async () => {
      try {
      const shared = JSON.parse(await decodeSharePayload(sharedValue));
      if (typeof shared.code !== "string" || !shared.code.trim()) return;
      setCode(shared.code);
      sharedPendingRef.current = true;
      if (ANALYSIS_MODES[shared.mode]) setAnalysisMode(shared.mode);
      if (shared.language && LANGUAGE_META[shared.language]) {
        const sharedMeta = resolveLanguageMeta(shared.language);
        setLangMeta(sharedMeta);
        setLanguageOverride(sharedMeta.id);
        setSelectedFileName(`shared.${sharedMeta.ext}`);
      }
      } catch {
        setErrorMsg("This share link is invalid or has been truncated.");
        setStatus("error");
      }
    })();
  }, []);

  // Picks up a "Load Example" hand-off from the Examples page.
  useEffect(() => {
    const pending = window.sessionStorage.getItem("ci-pending-example");
    if (!pending) return;
    try {
      const { code: pendingCode, language: pendingLanguage } = JSON.parse(pending);
      if (pendingCode) setCode(pendingCode);
      if (pendingLanguage) {
        const detectedMeta = resolveLanguageMeta(pendingLanguage);
        setLangMeta(detectedMeta);
        setLanguageOverride(detectedMeta.id);
        setSelectedFileName(`main.${detectedMeta.ext}`);
      }
      setResults(null);
      setStatus("idle");
    } catch {
      /* malformed payload — ignore and keep defaults */
    } finally {
      window.sessionStorage.removeItem("ci-pending-example");
    }
  }, []);

  const handleFileSelection = useCallback(async (file) => {
    if (!file) return;

    const fileName = file.name || "uploaded-file";

    try {
      const nextCode = await file.text();
      const detectedMeta = resolveLanguageMetaFromFilename(fileName);

      setCode(nextCode);
      setLangMeta(detectedMeta);
      setLanguageOverride(detectedMeta.id);
      setSelectedFileName(fileName);
      setStatus("idle");
      setResults(null);
      setErrorMsg("");
    } catch {
      setErrorMsg("Unable to read the selected file. Please try another file.");
      setStatus("error");
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
        body: JSON.stringify({ code, mode: analysisMode }),
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
        testCases: data.testCases ?? [],
        recursion: false,
      };

      setResults(builtResults);
      setLangMeta(resolvedMeta);
      setLanguageOverride(resolvedMeta.id);
      setSelectedFileName(
        selectedFileName && selectedFileName !== "main.txt" ? selectedFileName : `main.${resolvedMeta.ext}`
      );
      setStatus("done");

      setHistory(
        pushHistoryEntry({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          code,
          fileName: selectedFileName || `main.${resolvedMeta.ext}`,
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
  }, [code, selectedFileName]);

  useEffect(() => {
    if (!sharedPendingRef.current || !code.trim()) return;
    sharedPendingRef.current = false;
    handleAnalyze();
  }, [code, handleAnalyze]);

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
    setSelectedFileName("main.txt");
    setLanguageOverride("auto");
    setLangMeta(resolveLanguageMeta(null));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleLoadHistoryEntry = (entry) => {
    setCode(entry.code);
    const meta = entry.langMeta ?? resolveLanguageMeta(null);
    setLangMeta(meta);
    setLanguageOverride(meta.id);
    setSelectedFileName(entry.fileName || `main.${meta.ext}`);
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

  const handleExportMarkdown = () => {
    if (!results) return;
    downloadTextFile(
      `codeinsight-analysis.${Date.now()}.md`,
      buildMarkdownReport(code, results, analysisMode),
      "text/markdown;charset=utf-8"
    );
  };

  const handlePrintPdf = (previewElement) => {
    if (!results || !previewElement) return;
    const report = previewElement.outerHTML;
    const appStyles = Array.from(document.querySelectorAll("style"))
      .map((style) => style.textContent)
      .join("\n");
    // Open synchronously from the button click so browser popup blockers allow it.
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setNotice("Allow pop-ups for this site, then click Export PDF again.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>CodeInsight AI Analysis</title>
          <style>${appStyles}
            @page { margin: 18mm; }
            :root { color-scheme: light; }
            body { margin: 0; background: #e2e8f0; }
            .ci-report-preview__document { display: block; width: auto; max-width: 900px; min-height: auto; margin: 0 auto; padding: 32px 40px; box-shadow: none; }
            .ci-report-preview__document .ci-complexity-graph svg { min-height: 190px; }
            .ci-report-preview__section { break-inside: avoid; }
            .ci-report-preview__section[open] > summary { display: none; }
            .ci-report-preview__section:not([open]) { display: none; }
            .ci-report-preview__section pre { max-height: none; overflow: visible; white-space: pre-wrap; overflow-wrap: anywhere; }
            .ci-report-preview__print-note { display: none; }
            @media print {
              body { background: #fff; }
              .ci-report-preview__document { max-width: none; }
            }
          </style>
        </head>
        <body>
          ${report}
          <p class="print-help">Choose “Save as PDF” in the print dialog to download this report.</p>
        </body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    let hasPrinted = false;
    const print = () => {
      if (hasPrinted || printWindow.closed) return;
      hasPrinted = true;
      printWindow.print();
    };
    printWindow.onload = print;
    window.setTimeout(() => {
      print();
    }, 500);
  };

  const handleExportPdf = () => {
    if (results) setReportPreviewOpen(true);
  };

  const handleShare = async () => {
    if (!code.trim()) return;
    const payload = await encodeSharePayload(JSON.stringify({ code, mode: analysisMode, language: langMeta.id }));
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${payload}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Share link copied to clipboard.");
    } catch {
      window.prompt("Copy this share link:", shareUrl);
    }
  };

  const handleDownloadOptimized = () => {
    if (!results?.optimizedCode) return;
    downloadTextFile(
      `optimized.${langMeta.ext}`,
      results.optimizedCode,
      "text/plain;charset=utf-8"
    );
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
            <label className="ci-upload ci-btn ci-btn--ghost ci-btn--sm" aria-label="Upload a code file">
              <input
                ref={fileInputRef}
                type="file"
                className="ci-upload__input"
                accept={SUPPORTED_UPLOAD_EXTENSIONS.join(",")}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleFileSelection(file);
                }}
              />
              Upload file
            </label>

            <div className="ci-select">
              <select
                value={languageOverride}
                aria-label="Select programming language"
                onChange={(event) => {
                  const next = event.target.value;
                  setLanguageOverride(next);
                  const nextMeta = resolveLanguageMeta(next === "auto" ? null : next);
                  setLangMeta(nextMeta);
                  setSelectedFileName(nextMeta.ext === "txt" ? selectedFileName : selectedFileName.replace(/\.[^/.]+$/, `.${nextMeta.ext}`));
                }}
              >
                <option value="auto">Auto</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="c">C</option>
              </select>
              <svg className="ci-select__chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div className="ci-select ci-select--mode">
              <select
                value={analysisMode}
                aria-label="Select analysis mode"
                onChange={(event) => setAnalysisMode(event.target.value)}
              >
                {Object.entries(ANALYSIS_MODES).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
              <svg className="ci-select__chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

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
            {status === "done" && results && (
              <>
                <button type="button" className="ci-btn ci-btn--ghost ci-btn--sm" onClick={handleShare}>
                  Share link
                </button>
                <button type="button" className="ci-btn ci-btn--ghost ci-btn--sm" onClick={handleExportMarkdown}>
                  Export .md
                </button>
                <button type="button" className="ci-btn ci-btn--ghost ci-btn--sm" onClick={handleExportPdf}>
                  Export PDF
                </button>
                {results.optimizedCode && (
                  <button type="button" className="ci-btn ci-btn--ghost ci-btn--sm" onClick={handleDownloadOptimized}>
                    Download refactor
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {notice && (
          <div className="ci-analyze__notice" role="status">
            {notice}
            <button type="button" onClick={() => setNotice("")} aria-label="Dismiss notification">×</button>
          </div>
        )}

        <div className="ci-analyze__grid">
          {/* LEFT — editor */}
          <div
            className={`ci-editor-window${isDragActive ? " ci-editor-window--drag-active" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragActive(false);
              const file = event.dataTransfer.files?.[0];
              if (file) handleFileSelection(file);
            }}
          >
            <div className="ci-editor-window__titlebar">
              <span className="ci-dot ci-dot--red" />
              <span className="ci-dot ci-dot--yellow" />
              <span className="ci-dot ci-dot--green" />
              <span className="ci-editor-window__filename">{selectedFileName || `main.${langMeta.ext}`}</span>
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
                  delay={150}
                  title="Interactive Complexity Graph"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M4 19V5M4 19h16M7 15l3-4 3 2 5-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  <ComplexityGraph complexity={results.time} />
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
                  delay={210}
                  title="Suggested Test Cases"
                  icon={
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                >
                  <TestCaseGenerator testCases={results.testCases} language={langMeta.id} code={code} />
                </ResultCard>

                {hotspotMap.length > 0 && (
                  <ResultCard
                    delay={240}
                    title="Complexity Hotspots"
                    icon={
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M5 12h4l2-7 3 14 2-7h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    }
                  >
                    <div className="ci-hotspot-map">
                      {hotspotMap.map((item) => (
                        <div key={item.line} className={`ci-hotspot-row ci-hotspot-row--${item.tone}`}>
                          <span className="ci-hotspot-row__line">L{item.line}</span>
                          <span className="ci-hotspot-row__text">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </ResultCard>
                )}

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
                  <>
                    <ResultCard
                      delay={420}
                      title="Code Comparison"
                      icon={
                        <svg viewBox="0 0 24 24" fill="none">
                          <path d="M8 5h6v14H8M16 5h0M16 19h0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                    >
                      <SplitCodeComparison
                        originalCode={code}
                        optimizedCode={results.optimizedCode}
                        language={langMeta.id}
                        editorTheme={editorTheme}
                      />
                    </ResultCard>

                    <ResultCard
                      delay={430}
                      title="Optimized Code"
                      icon={
                        <svg viewBox="0 0 24 24" fill="none">
                          <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      }
                    >
                      <OptimizedCodeBlock code={results.optimizedCode} language={langMeta.id} editorTheme={editorTheme} />
                    </ResultCard>
                  </>
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
      {reportPreviewOpen && results && (
        <ReportPreview
          code={code}
          results={results}
          mode={analysisMode}
          onClose={() => setReportPreviewOpen(false)}
          onExportMarkdown={handleExportMarkdown}
          onExportPdf={handlePrintPdf}
          hotspotMap={hotspotMap}
        />
      )}
    <Footer />
    </div>
  );
}
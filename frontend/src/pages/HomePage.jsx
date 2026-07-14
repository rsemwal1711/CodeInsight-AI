import NavBar from "../components/Header";
import Footer from "../components/Footer";

/* ---------- Reusable bits ---------- */



/* Signature hero element: a mock editor that "analyzes itself" —
   a scan beam sweeps down the code and Big-O badges fade in in sequence. */
const AnalyzerPreview = () => {
  const lines = [
    { n: 1, code: [{ t: "kw", v: "function" }, { t: "fn", v: " findPair" }, { t: "pl", v: "(arr, target) {" }] },
    { n: 2, code: [{ t: "pl", v: "  " }, { t: "kw", v: "for" }, { t: "pl", v: " (let i = 0; i < arr.length; i++) {" }] },
    { n: 3, code: [{ t: "pl", v: "    " }, { t: "kw", v: "for" }, { t: "pl", v: " (let j = i + 1; j < arr.length; j++) {" }] },
    { n: 4, code: [{ t: "pl", v: "      " }, { t: "kw", v: "if" }, { t: "pl", v: " (arr[i] + arr[j] === target)" }] },
    { n: 5, code: [{ t: "pl", v: "        " }, { t: "kw", v: "return" }, { t: "pl", v: " [i, j];" }] },
    { n: 6, code: [{ t: "pl", v: "    }" }] },
    { n: 7, code: [{ t: "pl", v: "  }" }] },
    { n: 8, code: [{ t: "pl", v: "}" }] },
  ];

  return (
    <div className="ci-preview" role="img" aria-label="Editor window showing CodeInsight AI analyzing a nested loop function and surfacing complexity badges">
      <div className="ci-preview__titlebar">
        <span className="ci-dot ci-dot--red" />
        <span className="ci-dot ci-dot--yellow" />
        <span className="ci-dot ci-dot--green" />
        <span className="ci-preview__filename">findPair.js</span>
      </div>

      <div className="ci-preview__body">
        <div className="ci-preview__scanbeam" aria-hidden="true" />
        <pre className="ci-code">
          {lines.map((line) => (
            <div className="ci-code__line" key={line.n}>
              <span className="ci-code__ln">{line.n}</span>
              <code>
                {line.code.map((tok, i) => (
                  <span key={i} className={`tok-${tok.t}`}>
                    {tok.v}
                  </span>
                ))}
              </code>
            </div>
          ))}
        </pre>

        <div className="ci-badge ci-badge--time" style={{ animationDelay: "1.1s" }}>
          <span className="ci-badge__label">Time</span>
          <span className="ci-badge__value">O(n²)</span>
        </div>
        <div className="ci-badge ci-badge--space" style={{ animationDelay: "1.5s" }}>
          <span className="ci-badge__label">Space</span>
          <span className="ci-badge__value">O(1)</span>
        </div>
        <div className="ci-badge ci-badge--ok" style={{ animationDelay: "1.9s" }}>
          <span className="ci-dot-status" />
          No syntax errors
        </div>
      </div>
    </div>
  );
};

const Hero = () => (
  <section className="ci-hero">
    <div className="ci-hero__inner">
      <div className="ci-hero__copy">
        <span className="ci-eyebrow">AI-powered code analysis</span>
        <h1 className="ci-hero__title">
          Analyze, optimize, and understand your code with AI.
        </h1>
        <p className="ci-hero__desc">
          Instantly analyze your source code for time complexity, space
          complexity, syntax errors, and optimization suggestions.
        </p>
        <div className="ci-hero__actions">
          <a href="/analyze" className="ci-btn ci-btn--primary">
            Start Analyzing
          </a>
          <a href="/examples" className="ci-btn ci-btn--ghost">
            View Examples
          </a>
        </div>
        <div className="ci-hero__langs" aria-label="Supported languages">
          <span>Universal Language Support</span>
        </div>
      </div>

      <div className="ci-hero__visual">
        <AnalyzerPreview />
      </div>
    </div>
  </section>
);

const FEATURES = [
  {
    title: "Multi-Language Support",
    desc: "Supports All Languages.",
    icon: "layers",
  },
  {
    title: "Time Complexity Analysis",
    desc: "Estimate algorithm complexity instantly.",
    icon: "clock",
  },
  {
    title: "Space Complexity Analysis",
    desc: "Understand memory usage.",
    icon: "cube",
  },
  {
    title: "AI Optimization",
    desc: "Receive optimized code and its suggestions if any.",
    icon: "spark",
  },
  {
    title: "Syntax Error Detection",
    desc: "Detect syntax issues before execution.",
    icon: "alert",
  },
  {
    title: "AI Explanation",
    desc: "Understand why your algorithm behaves the way it does.",
    icon: "chat",
  },
];

const ICONS = {
  layers: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  cube: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M4 7.5L12 12l8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3l1.8 5.6L19 10.4l-5.2 1.8L12 18l-1.8-5.8L5 10.4l5.2-1.8L12 3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 3.5l9.5 16.5H2.5L12 3.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 10v4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M4 5h16v11H9l-5 4V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
};

const Features = () => (
  <section className="ci-section" id="features">
    <div className="ci-section__head">
      <span className="ci-eyebrow">What it does</span>
      <h2 className="ci-section__title">Everything you need to read your code better</h2>
      <p className="ci-section__desc">
        One paste, six ways to understand what your algorithm is actually doing.
      </p>
    </div>

    <div className="ci-grid ci-grid--features">
      {FEATURES.map((f) => (
        <article className="ci-card ci-feature-card" key={f.title}>
          <div className="ci-feature-card__icon">{ICONS[f.icon]}</div>
          <h3 className="ci-feature-card__title">{f.title}</h3>
          <p className="ci-feature-card__desc">{f.desc}</p>
        </article>
      ))}
    </div>
  </section>
);

const LANGUAGES = [
  { name: "All Languages", meta: "Universal support" },
  { name: "Compiled", meta: "C, C++, Rust, Go, etc." },
  { name: "Interpreted", meta: "Python, JavaScript, Ruby, etc." },
  { name: "JVM & .NET", meta: "Java, Kotlin, Scala, C#, etc." }
];

const SupportedLanguages = () => (
  <section className="ci-section ci-section--tight">
    <div className="ci-section__head">
      <span className="ci-eyebrow">Language support</span>
      <h2 className="ci-section__title">Write in what you know</h2>
    </div>

    <div className="ci-grid ci-grid--langs">
      {LANGUAGES.map((l) => (
        <div className="ci-lang-card" key={l.name}>
          <span className="ci-lang-card__name">{l.name}</span>
          <span className="ci-lang-card__meta">{l.meta}</span>
        </div>
      ))}
    </div>
  </section>
);



/* ---------- Page ---------- */

export default function HomePage() {
  return (
    <div className="ci-page">
      <NavBar />
      <main>
        <Hero />
        <Features />
        <SupportedLanguages />
      </main>
      <Footer />
    </div>
  );
}
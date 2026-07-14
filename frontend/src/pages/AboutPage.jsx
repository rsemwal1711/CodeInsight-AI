import React from "react";
import NavBar from "../components/Header";
import Footer from "../components/Footer";
import "./HomePage.css";
import "./AboutPage.css";

/* ---------- Shared chrome (same markup/classes as Home, so nav + footer
   stay pixel-identical across pages) ---------- */





/* ---------- About-page sections ---------- */

const AboutIntro = () => (
  <section className="ci-about-hero">
    <div className="ci-about-hero__inner">
      <span className="ci-eyebrow">About the project</span>
      <h1 className="ci-about-hero__title">Built to make complexity legible</h1>
      <p className="ci-about-hero__desc">
        CodeInsight AI reads your source code the way a senior engineer
        would in a code review — spotting inefficient loops, estimating
        Big-O, and explaining the reasoning in plain language.
      </p>
    </div>
  </section>
);

const OverviewMission = () => (
  <section className="ci-section ci-section--tight">
    <div className="ci-grid ci-grid--split">
      <div className="ci-split-card">
        <span className="ci-split-card__index">Overview</span>
        <h2 className="ci-split-card__title">What CodeInsight AI is</h2>
        <p className="ci-split-card__body">
          CodeInsight AI is a web application that analyzes source code
          across multiple languages. Paste in an algorithm and it estimates
          time and space complexity, flags syntax errors, and points out
          inefficient patterns — then suggests an optimized rewrite with an
          AI-generated explanation of why it's faster.
        </p>
      </div>

      <div className="ci-split-card">
        <span className="ci-split-card__index">Mission</span>
        <h2 className="ci-split-card__title">Why it exists</h2>
        <p className="ci-split-card__body">
          Most developers can tell you their code works. Fewer can tell you
          why it's slow. CodeInsight AI exists to close that gap — turning
          Big-O notation from a whiteboard-interview ritual into something
          you can check on your own code, in seconds, while you're still
          learning.
        </p>
      </div>
    </div>
  </section>
);

const STEPS = [
  { label: "Paste code", detail: "Editor captures your source" },
  { label: "Parse & tokenize", detail: "Build an AST per language" },
  { label: "Local LLM", detail: "Reasons over structure & loops" },
  { label: "Results panel", detail: "Complexity, fixes, explanation" },
];

const HowItWorks = () => (
  <section className="ci-section">
    <div className="ci-section__head">
      <span className="ci-eyebrow">How it works</span>
      <h2 className="ci-section__title">From paste to insight</h2>
      <p className="ci-section__desc">
        Every analysis moves through the same four stages, entirely on the
        server you control.
      </p>
    </div>

    <div className="ci-arch" role="img" aria-label="Architecture flow: Paste code, then Parse and tokenize, then Local LLM reasoning, then Results panel">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.label}>
          <div className="ci-arch__node">
            <span className="ci-arch__num">{String(i + 1).padStart(2, "0")}</span>
            <span className="ci-arch__label">{s.label}</span>
            <span className="ci-arch__detail">{s.detail}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="ci-arch__connector" aria-hidden="true">
              <svg viewBox="0 0 40 24" fill="none">
                <path d="M2 12h30" stroke="url(#ci-arch-grad)" strokeWidth="2" />
                <path d="M26 5l8 7-8 7" stroke="url(#ci-arch-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <linearGradient id="ci-arch-grad" x1="0" y1="0" x2="40" y2="0">
                    <stop stopColor="var(--ci-blue)" />
                    <stop offset="1" stopColor="var(--ci-purple)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  </section>
);

const STACK = [
  { role: "Frontend", name: "React", note: "Component-driven UI" },
  { role: "Backend", name: "FastAPI", note: "Python async API layer" },
  { role: "Editor", name: "Monaco Editor", note: "Same editor as VS Code" },
  { role: "AI", name: "Local LLM", note: "Runs analysis on-server" },
];

const TechStack = () => (
  <section className="ci-section ci-section--tight">
    <div className="ci-section__head">
      <span className="ci-eyebrow">Tech stack</span>
      <h2 className="ci-section__title">What it's built with</h2>
    </div>

    <div className="ci-grid ci-grid--stack">
      {STACK.map((t) => (
        <div className="ci-card ci-stack-card" key={t.role}>
          <span className="ci-stack-card__role">{t.role}</span>
          <span className="ci-stack-card__name">{t.name}</span>
          <span className="ci-stack-card__note">{t.note}</span>
        </div>
      ))}
    </div>
  </section>
);

const FUTURE = [
  "Support for Go, Rust, and TypeScript analysis",
  "Inline complexity annotations directly in the editor gutter",
  "Team workspaces with shared analysis history",
  "Downloadable PDF reports for code reviews",
];

const FutureImprovements = () => (
  <section className="ci-section">
    <div className="ci-section__head">
      <span className="ci-eyebrow">Roadmap</span>
      <h2 className="ci-section__title">Future improvements</h2>
    </div>

    <ul className="ci-future-list">
      {FUTURE.map((item) => (
        <li className="ci-future-list__item" key={item}>
          <span className="ci-future-list__check" aria-hidden="true">✓</span>
          {item}
        </li>
      ))}
    </ul>
  </section>
);

const DeveloperInfo = () => (
  <section className="ci-section ci-section--tight">
    <div className="ci-dev-card">
      <div className="ci-dev-card__avatar" aria-hidden="true">CI</div>
      <div className="ci-dev-card__body">
        <span className="ci-eyebrow">Developer</span>
        <h2 className="ci-dev-card__title">Maintained as an independent project</h2>
        <p className="ci-dev-card__desc">
          Built by a solo developer exploring how far AI-assisted static
          analysis can go for learners and interview prep. Feedback and
          contributions are welcome on GitHub.
        </p>
        <a href="https://github.com" className="ci-btn ci-btn--ghost ci-btn--sm">
          View on GitHub
        </a>
      </div>
    </div>
  </section>
);

/* ---------- Page ---------- */

export default function AboutPage() {
  return (
    <div className="ci-page">
      <NavBar />
      <main>
        <AboutIntro />
        <OverviewMission />
        <HowItWorks />
        <TechStack />
        <FutureImprovements />
        <DeveloperInfo />
      </main>
      <Footer />
    </div>
  );
}
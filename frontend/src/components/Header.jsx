import { useState, useEffect } from "react";
import "./Header.css";
import { NavLink } from "react-router-dom";

import { useTheme } from "../context/ThemeContext"; // adjust path to wherever you save it

const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`ci-theme-toggle${isDark ? " ci-theme-toggle--dark" : ""}`}
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span className="ci-theme-toggle__orb">
        <svg viewBox="0 0 24 24" fill="none" className="ci-theme-toggle__sun">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="1.5" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22.5" y2="12" />
          <line x1="4.4" y1="4.4" x2="6.1" y2="6.1" />
          <line x1="17.9" y1="17.9" x2="19.6" y2="19.6" />
          <line x1="4.4" y1="19.6" x2="6.1" y2="17.9" />
          <line x1="17.9" y1="6.1" x2="19.6" y2="4.4" />
        </svg>
        <svg viewBox="0 0 24 24" fill="none" className="ci-theme-toggle__moon">
          <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
        </svg>
      </span>
    </button>
  );
};

const NAV_ITEMS = [
  { to: "/", label: "Home", end: true },
  { to: "/analyze", label: "Analyze" },
  { to: "/examples", label: "Examples" },
  { to: "/about", label: "About" },
];

const NavBar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile menu automatically if the viewport is resized back up
  // past the breakpoint (e.g. rotating a tablet, or a desktop dev-tools
  // resize) so it doesn't stay stuck open behind the now-visible desktop nav.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 980) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Lock body scroll while the mobile menu is open, and let Escape close it.
  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    const handleEsc = (e) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", handleEsc);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEsc);
    };
  }, [mobileOpen]);

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <header className="ci-nav">
      <div className="ci-nav__inner">
        <NavLink to="/" end className="ci-logo" onClick={closeMobileMenu}>
          <span className="ci-logo__mark">{"</>"}</span>
          <span className="ci-logo__text">
            CodeInsight<span className="ci-logo__accent">AI</span>
          </span>
        </NavLink>

        <nav className="ci-nav__links" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `ci-nav__link${isActive ? " ci-nav__link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ci-nav__right">
          <ThemeToggle />

          <button
            type="button"
            className={`ci-nav__hamburger${mobileOpen ? " ci-nav__hamburger--open" : ""}`}
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="ci-mobile-menu"
          >
            <span className="ci-nav__hamburger-bar" />
            <span className="ci-nav__hamburger-bar" />
            <span className="ci-nav__hamburger-bar" />
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu — only relevant/visible below the 980px
          breakpoint where .ci-nav__links is hidden via CSS. */}
      <div
        id="ci-mobile-menu"
        className={`ci-nav__mobile-menu${mobileOpen ? " ci-nav__mobile-menu--open" : ""}`}
      >
        <nav aria-label="Mobile primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                `ci-nav__mobile-link${isActive ? " ci-nav__mobile-link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Backdrop — click outside the menu to close it */}
      {mobileOpen && (
        <div className="ci-nav__backdrop" onClick={closeMobileMenu} aria-hidden="true" />
      )}
    </header>
  );
};

export default NavBar;
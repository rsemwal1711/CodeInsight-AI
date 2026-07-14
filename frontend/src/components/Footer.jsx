import './Footer.css'
const Footer = () => (
  <footer className="ci-footer">
    <div className="ci-footer__inner">
      <div className="ci-footer__brand">
        <span className="ci-logo__mark">{"</>"}</span>
        <span className="ci-logo__text">
          CodeInsight<span className="ci-logo__accent">AI</span>
        </span>
      </div>
      <div className="ci-footer__links">
        <a href="https://github.com/rsemwal1711" className="ci-footer__link">GitHub</a>
        <a href="mailto:hello@codeinsight.ai" className="ci-footer__link">Contact</a>
        <span className="ci-footer__version">v1.0.0</span>
      </div>
    </div>
  </footer>
);
export default Footer;
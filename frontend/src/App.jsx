import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import AnalyzePage from "./pages/AnalyzePage";
import ExamplesPage from "./pages/ExamplesPage";

function App() {
  return (
    <BrowserRouter>
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="/examples" element={<ExamplesPage />} />
      </Routes>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
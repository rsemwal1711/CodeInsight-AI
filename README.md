# 🧠 CodeInsight AI

**AI-powered code analysis tool** that detects your programming language, evaluates time & space complexity, catches syntax errors, and delivers optimization suggestions — all inside a VS Code–style Monaco editor.

<p align="left">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Monaco-Editor-007ACC?logo=visualstudiocode&logoColor=white" alt="Monaco Editor" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## ✨ Features

- 🔍 **Automatic Language Detection** — just paste code, no manual language selection needed
- ⏱️ **Time & Space Complexity Analysis** — Big-O breakdown powered by real parsing (tree-sitter), not guesswork
- 🐞 **Syntax Error Detection** — pinpoints issues with line-level detail
- 💡 **AI Optimization Suggestions** — actionable, categorized recommendations with severity indicators
- 🤖 **AI Explanation Panel** — plain-language breakdown of what your code does and why it performs the way it does
- 🔁 **Optimized Code Rewrite** — view a suggested, more efficient version of your code side-by-side
- 🕘 **Analysis History** — past runs are saved locally so you can revisit or reload them anytime
- 🌗 **Light / Dark Theme** — full theme toggle with a custom Monaco color scheme for both modes
- 🔎 **Editor Zoom** — pinch-to-zoom (trackpad & touchscreen) and Ctrl/Cmd + scroll support on all code panels
- 📱 **Fully Responsive** — optimized layouts and a native mobile hamburger menu down to small phone screens
- ⚡ **Fast, Modern Stack** — built with Vite + React on the frontend, Express + tree-sitter on the backend

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React, Vite, React Router, Monaco Editor |
| **Backend** | Node.js, Express, Tree-sitter (multi-language parsing) |
| **Styling** | Custom CSS design system (no framework) |
| **State/Storage** | React state, `localStorage` for history persistence |

---

## 📸 Preview

> Add screenshots or a demo GIF here once available, e.g.:
>
> ```markdown
> ![CodeInsight AI Screenshot](./docs/screenshot-home.png)
> ![Analyze Page Screenshot](./docs/screenshot-analyze.png)
> ```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes bundled with Node.js)

### 1. Clone the repository

```bash
git clone https://github.com/rsemwal1711/CodeInsight-AI.git
cd CodeInsight-AI
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/` (see [Environment Variables](#-environment-variables) below), then start the server:

```bash
node server.js
```

By default, the backend runs on `http://localhost:8000`.

### 3. Set up the frontend

Open a new terminal window:

```bash
cd frontend
npm install
```

Create a `.env` file inside `frontend/` with your API base URL:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Then start the dev server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or whichever port Vite assigns).

---

## 🔐 Environment Variables

Neither `.env` file is committed to this repository — create them locally using the templates below.

**`backend/.env`**

```env
PORT=8000
# Add any AI provider keys, database URLs, or other secrets here
```

**`frontend/.env`**

```env
VITE_API_BASE_URL=http://localhost:8000
```

> ⚠️ Never commit real `.env` files. This repo's `.gitignore` already excludes them — if you're forking or setting this up fresh, double check `.env` isn't tracked before pushing.

---

## 📁 Project Structure

```
CodeInsight-AI/
├── backend/                 # Express API + tree-sitter analysis engine
│   ├── server.js
│   └── ...
├── frontend/                 # React + Vite client
│   ├── src/
│   │   ├── pages/            # HomePage, AnalyzePage, ExamplesPage, About
│   │   ├── components/       # Header (NavBar), Footer, shared UI
│   │   └── context/          # ThemeContext (light/dark mode)
│   └── ...
├── .gitignore
└── README.md
```

---

## 🧭 Usage

1. Open the **Analyze** page
2. Paste or write code directly into the editor
3. Click **Analyze** (or press `Ctrl` / `Cmd` + `Enter`)
4. Review detected language, complexity ratings, syntax errors, and suggestions in the results panel
5. Expand the **Optimized Code** block for a full-screen, copyable rewrite
6. Revisit past analyses anytime from the **History** panel

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m "Add your feature"`)
4. Push to your branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## 📬 Contact

Built by [**rsemwal1711**](https://github.com/rsemwal1711)

For questions, issues, or feature requests, please [open an issue](https://github.com/rsemwal1711/CodeInsight-AI/issues).

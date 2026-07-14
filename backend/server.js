// /**
//  * CodeInsight AI — analysis API (Node/Express).
//  *
//  * Run locally:
//  *   npm install
//  *   node server.js
//  *
//  * Then point the frontend at http://localhost:8000
//  * (see API_BASE_URL in AnalyzePage.jsx).
//  */

// const express = require("express");
// const cors = require("cors");
// const { analyze } = require("./analyzers/treesitteranalyzer");

// const app = express();
// app.use(cors()); // tighten this to your frontend's origin before deploying
// app.use(express.json({ limit: "1mb" }));

// const LANGUAGE_LABELS = { javascript: "JavaScript", python: "Python", java: "Java", cpp: "C++" };

// app.post("/api/analyze", (req, res) => {
//   const { code, language } = req.body || {};

//   if (!language || !LANGUAGE_LABELS[language]) {
//     return res.status(400).json({ error: `Unsupported language: ${language}` });
//   }
//   if (!code || !code.trim()) {
//     return res.status(400).json({ error: "No code provided." });
//   }

//   try {
//     const result = analyze(code, language);
//     return res.json({
//       detectedLanguage: LANGUAGE_LABELS[language],
//       ...result,
//     });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ error: "Analysis failed on the server." });
//   }
// });

// app.get("/health", (_req, res) => res.json({ status: "ok" }));

// const PORT = process.env.PORT || 8000;
// app.listen(PORT, () => console.log(`CodeInsight AI API running on http://localhost:${PORT}`));


require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are an expert software engineer. Analyze the following source code.
Return ONLY valid JSON, with no markdown formatting, no code fences, and no preamble or explanation outside the JSON.
The JSON must match exactly this shape:
{
  "language": "",
  "timeComplexity": "",
  "spaceComplexity": "",
  "syntaxErrors": [],
  "algorithm": "",
  "dataStructures": [],
  "optimizationSuggestions": [],
  "performanceComparison": "",
  "explanation": [],
  "confidence": "",
  "optimizedCode": ""
}

Rules for "explanation": return an array of 2-4 short bullet points (each under 15 words), covering only the most important takeaways — what the algorithm does, why it has this complexity, and the single biggest thing to improve. Do NOT write a paragraph.

Rules for "optimizedCode": if a more efficient version of the algorithm exists, rewrite the full code with that optimization applied, in the same language as the input. Keep it complete and runnable, not a snippet. If the code is already optimal, return an empty string "".`;

app.post("/api/analyze", async (req, res) => {
  const { code, language } = req.body || {};

  if (!code || typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: code },
    ]);

    const rawText = result.response.text() || "";
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse model output:", cleaned);
      return res.status(502).json({ error: "Model did not return valid JSON" });
    }

    res.json(analysis);
  } catch (err) {
    if (err.status === 429) {
      console.warn("Gemini 429 — rate limited.");
      console.warn("Full error details:", JSON.stringify(err.errorDetails || err.message || err, null, 2));
      return res.status(429).json({ error: "Rate limit hit, please wait a moment." });
    }
    console.error("Gemini API error:", err.message || err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
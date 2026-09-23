require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(resolve, { timedOut: true, stdout, stderr });
    }, options.timeoutMs || 2000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 100000) child.kill();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 100000) child.kill();
    });
    child.on("error", (error) => finish(reject, error));
    child.on("close", (exitCode) => finish(resolve, { exitCode, stdout, stderr }));
  });
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODE_GUIDANCE = {
  interview: "Focus on Big-O notation, recursive depth, loop nesting, edge cases, and the strongest algorithmic trade-offs.",
  clean: "Focus on readability, variable naming, modularity, duplication, and maintainable structure while still preserving behavior.",
  security: "Focus strictly on syntax risks, edge-case crashes, input validation gaps, unsafe assumptions, and common security issues like injection, path traversal, unchecked input, and null/empty handling."
};

function getSystemPrompt(mode = "interview") {
  const selectedMode = MODE_GUIDANCE[mode] || MODE_GUIDANCE.interview;

  return `You are an expert software engineer. Analyze the following source code.
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
  "optimizedCode": "",
  "testCases": [
    {
      "input": "",
      "expectedBehavior": "",
      "reason": ""
    }
  ]
}

Mode guidance: ${selectedMode}

Rules for "explanation": return an array of 2-4 short bullet points (each under 15 words), covering only the most important takeaways — what the algorithm does, why it has this complexity, and the single biggest thing to improve. Do NOT write a paragraph.

Rules for "optimizedCode": if a more efficient version of the algorithm exists, rewrite the full code with that optimization applied, in the same language as the input. Keep it complete and runnable, not a snippet. If the code is already optimal, return an empty string "".

Rules for "testCases": return 3-6 concrete, safe edge-case inputs the user can run manually. Cover relevant cases such as empty input, null input, zero, negative values, duplicates, already sorted data, or very large input when applicable. Use valid JSON strings for input, and briefly explain why each case matters.`;
}

app.post("/api/run-java", async (req, res) => {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_LOCAL_CODE_EXECUTION !== "true") {
    return res.status(403).json({
      error: "Java execution is available only on an explicitly enabled local backend.",
    });
  }

  const { code, input = "" } = req.body || {};
  if (!code || typeof code !== "string" || code.length > 100000) {
    return res.status(400).json({ error: "Java source is required and must be under 100 KB." });
  }
  if (typeof input !== "string" || input.length > 10000) {
    return res.status(400).json({ error: "Test input must be text under 10 KB." });
  }
  if (/\bpackage\s+[A-Za-z0-9_.]+\s*;/.test(code)) {
    return res.status(400).json({ error: "Remove the package declaration before running a local test." });
  }
  if (!/\bstatic\s+void\s+main\s*\(/.test(code)) {
    return res.status(400).json({
      error: "Java test execution requires a public static void main(String[] args) method that reads stdin.",
    });
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeinsight-java-"));
  const sourcePath = path.join(workDir, "Main.java");

  try {
    const source = code.replace(/\bpublic\s+class\s+[A-Za-z_$][\w$]*/, "public class Main");
    await fs.writeFile(sourcePath, source, "utf8");

    const compile = await runProcess("javac", ["-encoding", "UTF-8", "-d", workDir, sourcePath], {
      cwd: workDir,
      timeoutMs: 5000,
    });
    if (compile.timedOut || compile.exitCode !== 0) {
      return res.status(422).json({ error: compile.timedOut ? "Java compilation timed out." : compile.stderr || "Java compilation failed." });
    }

    const execution = await runProcess("java", ["-cp", workDir, "Main"], {
      cwd: workDir,
      timeoutMs: 2000,
    });
    if (execution.timedOut) {
      return res.status(408).json({ error: "Java execution timed out after 2 seconds." });
    }
    if (execution.exitCode !== 0) {
      return res.status(422).json({ error: execution.stderr || "Java program exited with an error.", output: execution.stdout });
    }
    return res.json({ output: execution.stdout });
  } catch (error) {
    if (error.code === "ENOENT") {
      return res.status(503).json({ error: "Java/JDK is not installed or is not available on the backend PATH." });
    }
    console.error("Local Java execution error:", error.message || error);
    return res.status(500).json({ error: "Unable to run the local Java test." });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
});

app.post("/api/analyze", async (req, res) => {
  const { code, language, mode } = req.body || {};

  if (!code || typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "No code provided" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const systemPrompt = getSystemPrompt(mode);

    const result = await model.generateContent([
      { text: systemPrompt },
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
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/test-gemini", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is not configured",
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Reply with exactly: CivicPulse Gemini test successful",
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data,
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "No text returned";

    res.json({
      success: true,
      response: text,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "Gemini request failed",
    });
  }
});

// Classify a complaint's severity via Gemini. Returns strict JSON
// { severity: 1-5, reasoning: string, confidence: 0-1 }. Any failure
// (missing key, upstream error, malformed model JSON) returns a non-2xx so
// the client falls back deterministically. The complaint TYPE is never
// changed here — this only assesses severity.
app.post("/classify", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(502).json({ error: "GEMINI_API_KEY is not configured" });
    }

    const type = String(req.body?.type ?? "").slice(0, 120);
    const description = String(req.body?.description ?? "").slice(0, 2000);
    if (!description.trim()) {
      return res.status(400).json({ error: "description is required" });
    }

    const prompt =
      "You are a municipal grievance triage assistant for a city corporation. " +
      "Assess ONLY the severity of the following civic complaint. Do NOT change " +
      "its category.\n\n" +
      `Complaint type: ${type}\n` +
      `Description: ${description}\n\n` +
      "Respond with JSON only, matching exactly this schema: " +
      '{"severity": <integer 1-5, where 1=minor and 5=critical/urgent public ' +
      'safety>, "reasoning": "<one concise sentence>", "confidence": <number ' +
      "between 0 and 1>}.";

    // Server-side abort guard so a hung upstream call can't pin the request.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    let response;
    try {
      response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          }),
        }
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      return res.status(502).json({ error: "Gemini request failed" });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(502).json({ error: "Empty Gemini response" });
    }

    // Parse the model's JSON; malformed output is a failure, not a crash.
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "Malformed Gemini JSON" });
    }

    const severity = Number(parsed?.severity);
    const reasoning = parsed?.reasoning;
    if (
      !Number.isInteger(severity) ||
      severity < 1 ||
      severity > 5 ||
      typeof reasoning !== "string" ||
      !reasoning.trim()
    ) {
      return res.status(502).json({ error: "Invalid classification shape" });
    }

    let confidence = Number(parsed?.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      confidence = 0.8; // sane default when the model omits/garbles it
    }

    return res.json({
      severity,
      reasoning: reasoning.trim(),
      confidence,
    });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Classification failed" });
  }
});

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`CivicPulse proxy running at http://localhost:${PORT}`);
});
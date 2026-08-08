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

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`CivicPulse proxy running at http://localhost:${PORT}`);
});
// AI teacher proxy: keeps the Anthropic API key on the server, only for signed-in students.
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
admin.initializeApp();
const KEY = defineSecret("ANTHROPIC_API_KEY");

exports.teacher = onRequest({ secrets: [KEY], maxInstances: 2, region: "us-central1" }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const token = (req.get("Authorization") || "").replace(/^Bearer /, "");
  try { await admin.auth().verifyIdToken(token); } catch (e) { return res.status(401).json({ error: "Please sign in" }); }
  const { system, messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length || messages.length > 24) return res.status(400).json({ error: "Bad request" });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY.value(), "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: 900,
      system: String(system || "").slice(0, 8000),
      messages: messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 4000) }))
    })
  });
  const j = await r.json();
  if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || "Teacher unavailable" });
  res.json({ text: (j.content || []).map(c => c.text || "").join("") });
});

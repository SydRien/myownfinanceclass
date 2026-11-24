// AI teacher proxy.
// - Keeps the Anthropic API key on the server and only answers signed-in students.
// - Supports tool use: Claude may ask to look up the student's own learning data.
//   The page runs those lookups against the student's saved progress and sends the
//   results back in the next request, so this function never stores any data.
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
admin.initializeApp();
const KEY = defineSecret("ANTHROPIC_API_KEY");

const MODEL = "claude-haiku-5-5";
const ALLOWED_TOOLS = new Set([
  "get_progress", "get_quiz_history", "get_lesson_quiz_results", "get_journal",
  "get_real_money_log", "get_scorecard", "get_paper_portfolio", "get_week_content"
]);

// Keep only plain text, tool_use and tool_result blocks, with size caps.
function cleanContent(c) {
  if (typeof c === "string") return c.slice(0, 6000);
  if (!Array.isArray(c)) return "";
  return c.slice(0, 20).map(b => {
    if (b.type === "text") return { type: "text", text: String(b.text || "").slice(0, 6000) };
    if (b.type === "tool_use" && ALLOWED_TOOLS.has(b.name)) return { type: "tool_use", id: String(b.id), name: b.name, input: b.input || {} };
    if (b.type === "tool_result") return { type: "tool_result", tool_use_id: String(b.tool_use_id), content: String(b.content || "").slice(0, 12000) };
    return null;
  }).filter(Boolean);
}

exports.teacher = onRequest({ secrets: [KEY], maxInstances: 2, region: "us-central1", timeoutSeconds: 60 }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const token = (req.get("Authorization") || "").replace(/^Bearer /, "");
  try { await admin.auth().verifyIdToken(token); } catch (e) { return res.status(401).json({ error: "Please sign in" }); }

  const { system, messages, tools } = req.body || {};
  if (!Array.isArray(messages) || !messages.length || messages.length > 40) return res.status(400).json({ error: "Bad request" });
  if (JSON.stringify(req.body).length > 150000) return res.status(413).json({ error: "Request too large" });

  const toolDefs = Array.isArray(tools)
    ? tools.filter(t => t && ALLOWED_TOOLS.has(t.name)).map(t => ({
        name: t.name, description: String(t.description || "").slice(0, 600), input_schema: t.input_schema || { type: "object", properties: {} }
      }))
    : [];

  const body = {
    model: MODEL,
    max_tokens: 900,
    system: String(system || "").slice(0, 9000),
    messages: messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: cleanContent(m.content) }))
  };
  if (toolDefs.length) body.tools = toolDefs;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY.value(), "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || "Teacher unavailable" });
  res.json({
    stop_reason: j.stop_reason,
    content: j.content || [],
    text: (j.content || []).filter(c => c.type === "text").map(c => c.text).join("")
  });
});

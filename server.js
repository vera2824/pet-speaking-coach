import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const envPath = path.join(__dirname, ".env");

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || (process.env.RENDER || process.env.RAILWAY_ENVIRONMENT ? "0.0.0.0" : "127.0.0.1");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const APP_ACCESS_CODE = process.env.APP_ACCESS_CODE || "";
const REALTIME_MODEL = process.env.REALTIME_MODEL || "gpt-realtime-2.1";
const REPORT_MODEL = process.env.REPORT_MODEL || "gpt-5.5";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const topics = {
  today: {
    label: "Weekend",
    instructions:
      "Run a short B1 Preliminary for Schools speaking warm-up about weekends, hobbies, food, school, and friends. Ask one question at a time."
  },
  photo: {
    label: "Photo Talk",
    instructions:
      "This is PET Speaking Part 2 practice. Ask the child to describe the picture card on screen: children making sandwiches in a bright kitchen. Then ask two simple follow-up questions."
  },
  mock: {
    label: "Mini Mock",
    instructions:
      "Run a mini PET Speaking practice: Part 1 personal questions, Part 2 describe a picture, Part 3 choose between activities, Part 4 short opinions. Keep it friendly and under ten minutes."
  }
};

function loadDotEnv() {
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function hasApiAccess(req) {
  if (!APP_ACCESS_CODE) return true;
  return req.headers["x-app-access-code"] === APP_ACCESS_CODE;
}

function requireApiAccess(req, res) {
  if (hasApiAccess(req)) return true;
  json(res, 401, { error: "Access code required." });
  return false;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function readJson(req) {
  const body = await readBody(req);
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    return null;
  }
}

function buildRealtimeSession(mode) {
  const selected = topics[mode] || topics.today;
  return {
    type: "realtime",
    model: REALTIME_MODEL,
    instructions: [
      "You are Lily, a kind English speaking coach for a 10-year-old Chinese girl preparing for Cambridge B1 Preliminary for Schools.",
      "Speak only in English during the child session. Use short, clear sentences and a warm voice.",
      "Keep the child speaking. Ask exactly one question at a time. Wait for her answer before moving on.",
      "Do not lecture. Do not overload corrections. At the end, give one encouragement, one small correction, and one improved sentence.",
      "If the child is silent or nervous, give a simple choice question.",
      selected.instructions
    ].join("\n"),
    audio: {
      input: {
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "en",
          prompt: "A child is practicing Cambridge PET speaking topics: school, friends, hobbies, food, family, weekends, holidays."
        },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "medium",
          create_response: true,
          interrupt_response: true
        },
        noise_reduction: {
          type: "near_field"
        }
      },
      output: {
        voice: "marin",
        speed: 0.92
      }
    }
  };
}

async function createRealtimeCall(req, res) {
  if (!requireApiAccess(req, res)) return;
  if (!OPENAI_API_KEY) {
    return json(res, 500, {
      error: "Missing OPENAI_API_KEY. Create a .env file first."
    });
  }

  const body = await readJson(req);
  if (!body || !body.sdp) {
    return json(res, 400, { error: "Missing SDP offer." });
  }

  const form = new FormData();
  form.set("sdp", body.sdp);
  form.set("session", JSON.stringify(buildRealtimeSession(body.mode)));

  const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Safety-Identifier": "pet-speaking-coach-child-1"
    },
    body: form
  });

  const answer = await upstream.text();
  if (!upstream.ok) {
    res.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: answer }));
    return;
  }

  json(res, 201, {
    sdp: answer,
    callId: (upstream.headers.get("location") || "").split("/").pop() || null
  });
}

async function hangupRealtimeCall(req, res, callId) {
  if (!OPENAI_API_KEY || !callId) return json(res, 204, {});
  await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/hangup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
  }).catch(() => null);
  json(res, 200, { ok: true });
}

function fallbackReport(payload) {
  const childTurns = payload.transcript.filter((turn) => turn.role === "child");
  const words = childTurns
    .flatMap((turn) => turn.text.toLowerCase().match(/[a-z']+/g) || [])
    .filter((word) => word.length > 2);
  const unique = [...new Set(words)].slice(0, 8);

  return {
    summaryZh: "今天完成了一次英语口语练习。可以先关注是否愿意持续开口，再逐步提高句子长度和准确度。",
    childPraise: "Great job speaking today!",
    bestSentence: childTurns[0]?.text || "I tried my best today.",
    correction: {
      original: "I like play tennis.",
      improved: "I like playing tennis.",
      reasonZh: "like 后面接动词时，通常用 -ing 形式。"
    },
    newWords: unique.length ? unique : ["usually", "weekend", "friend"],
    scores: {
      fluency: 3,
      vocabulary: 3,
      grammar: 3,
      pronunciation: 3,
      interaction: 3
    },
    nextPracticeZh: "下次可以继续练习 weekend、school 和 hobbies，让她多说 because 连接原因。"
  };
}

async function createReport(req, res) {
  if (!requireApiAccess(req, res)) return;
  const payload = await readJson(req);
  if (!payload || !Array.isArray(payload.transcript)) {
    return json(res, 400, { error: "Missing transcript." });
  }

  if (!OPENAI_API_KEY) {
    return json(res, 200, { report: fallbackReport(payload), fallback: true });
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      summaryZh: { type: "string" },
      childPraise: { type: "string" },
      bestSentence: { type: "string" },
      correction: {
        type: "object",
        additionalProperties: false,
        properties: {
          original: { type: "string" },
          improved: { type: "string" },
          reasonZh: { type: "string" }
        },
        required: ["original", "improved", "reasonZh"]
      },
      newWords: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 5
      },
      scores: {
        type: "object",
        additionalProperties: false,
        properties: {
          fluency: { type: "integer", minimum: 1, maximum: 5 },
          vocabulary: { type: "integer", minimum: 1, maximum: 5 },
          grammar: { type: "integer", minimum: 1, maximum: 5 },
          pronunciation: { type: "integer", minimum: 1, maximum: 5 },
          interaction: { type: "integer", minimum: 1, maximum: 5 }
        },
        required: ["fluency", "vocabulary", "grammar", "pronunciation", "interaction"]
      },
      nextPracticeZh: { type: "string" }
    },
    required: [
      "summaryZh",
      "childPraise",
      "bestSentence",
      "correction",
      "newWords",
      "scores",
      "nextPracticeZh"
    ]
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: REPORT_MODEL,
      input: [
        {
          role: "system",
          content:
            "You are a warm PET speaking coach. Generate a short Chinese parent report and child-friendly English feedback from a practice transcript. Be encouraging and correct only one important issue."
        },
        {
          role: "user",
          content: JSON.stringify(payload)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "speaking_report",
          schema,
          strict: true
        }
      }
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    return json(res, 200, { report: fallbackReport(payload), fallback: true });
  }

  const outputText =
    data.output_text ||
    data.output?.flatMap((item) => item.content || [])?.find((part) => part.text)?.text;

  try {
    return json(res, 200, { report: JSON.parse(outputText), fallback: false });
  } catch {
    return json(res, 200, { report: fallbackReport(payload), fallback: true });
  }
}

async function saveSession(req, res) {
  if (!requireApiAccess(req, res)) return;
  const payload = await readJson(req);
  if (!payload) return json(res, 400, { error: "Invalid session payload." });
  await mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, `session-${Date.now()}.json`);
  await writeFile(file, JSON.stringify(payload, null, 2));
  json(res, 201, { ok: true });
}

async function serveStatic(req, res, pathname) {
  let target = pathname === "/" ? "/index.html" : pathname;
  target = decodeURIComponent(target);
  const filePath = path.normalize(path.join(publicDir, target));
  if (!filePath.startsWith(publicDir)) return json(res, 403, { error: "Forbidden" });

  try {
    const file = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600"
    });
    res.end(file);
  } catch {
    const file = await readFile(path.join(publicDir, "index.html"));
    res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
    res.end(file);
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/api/realtime/call") {
      return createRealtimeCall(req, res);
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/realtime/call/")) {
      return hangupRealtimeCall(req, res, url.pathname.split("/").pop());
    }

    if (req.method === "POST" && url.pathname === "/api/report") {
      return createReport(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/sessions") {
      return saveSession(req, res);
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET") {
      return serveStatic(req, res, url.pathname);
    }

    json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Server error." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`PET Speaking Coach is running at http://${HOST}:${PORT}`);
});

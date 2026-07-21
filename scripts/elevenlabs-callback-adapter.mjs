import "dotenv/config";
import fs from "node:fs/promises";

function parseArgs(argv) {
  const args = {
    callbackUrl: process.env.SAION_CALLBACK_URL || "http://localhost:3000/api/provider/callback",
    generator: "elevenlabs",
    inputFile: "",
    requestId: "",
    jobId: "",
    statusCode: 200,
    token: process.env.NOCODE_CALLBACK_TOKEN || process.env.PROVIDER_CALLBACK_TOKEN || process.env.CALLBACK_TOKEN || ""
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];

    if (key === "--callback-url" && next) {
      args.callbackUrl = next;
      i += 1;
      continue;
    }
    if (key === "--generator" && next) {
      args.generator = next;
      i += 1;
      continue;
    }
    if (key === "--input" && next) {
      args.inputFile = next;
      i += 1;
      continue;
    }
    if (key === "--request-id" && next) {
      args.requestId = next;
      i += 1;
      continue;
    }
    if (key === "--job-id" && next) {
      args.jobId = next;
      i += 1;
      continue;
    }
    if (key === "--status-code" && next) {
      const numeric = Number(next);
      if (Number.isFinite(numeric)) args.statusCode = numeric;
      i += 1;
      continue;
    }
    if (key === "--token" && next) {
      args.token = next;
      i += 1;
    }
  }

  return args;
}

function safeJsonParse(value, fallback = {}) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readStdinText() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }

    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data.trim());
    });
  });
}

function firstString(value, candidates) {
  if (!value || typeof value !== "object") return "";
  for (const keyPath of candidates) {
    const parts = keyPath.split(".");
    let current = value;
    let found = true;
    for (const part of parts) {
      if (!current || typeof current !== "object" || !(part in current)) {
        found = false;
        break;
      }
      current = current[part];
    }
    if (found && typeof current === "string" && current.trim()) {
      return current.trim();
    }
  }
  return "";
}

function extractAudioUrl(payload) {
  if (!payload || typeof payload !== "object") return "";

  const direct = firstString(payload, [
    "audioUrl",
    "audio_url",
    "url",
    "outputUrl",
    "output_url",
    "result.audioUrl",
    "result.audio_url",
    "data.audioUrl",
    "data.audio_url"
  ]);
  if (direct) return direct;

  const listCandidates = ["audioUrls", "audio_urls", "tracks", "outputs", "artifacts"];
  for (const key of listCandidates) {
    const list = payload[key];
    if (!Array.isArray(list) || list.length === 0) continue;
    const first = list[0];
    if (typeof first === "string" && first.startsWith("http")) return first;
    if (first && typeof first === "object") {
      const nested = extractAudioUrl(first);
      if (nested) return nested;
    }
  }

  const nestedCandidates = ["data", "result", "response", "output"];
  for (const key of nestedCandidates) {
    if (payload[key] && typeof payload[key] === "object") {
      const nested = extractAudioUrl(payload[key]);
      if (nested) return nested;
    }
  }

  return "";
}

function normalizeStatus(payload) {
  const raw = firstString(payload, [
    "status",
    "state",
    "result.status",
    "result.state",
    "data.status",
    "data.state"
  ]).toLowerCase();

  if (!raw) return "processing";
  if (["done", "finished", "completed", "success", "succeeded"].includes(raw)) return "completed";
  if (["failed", "error", "cancelled", "canceled"].includes(raw)) return "failed";
  if (["queued", "pending", "accepted", "created"].includes(raw)) return "queued";
  return "processing";
}

function buildSaionCallbackPayload(rawPayload, overrides) {
  const payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  const requestId =
    overrides.requestId ||
    firstString(payload, ["requestId", "request_id", "metadata.requestId", "custom_data.requestId", "user_data.requestId"]);
  const jobId = overrides.jobId || firstString(payload, ["jobId", "job_id", "id", "taskId", "task_id"]);

  const response =
    payload.response && typeof payload.response === "object"
      ? { ...payload.response }
      : { ...payload };

  const status = normalizeStatus(payload);
  if (!response.status) {
    response.status = status;
  }

  const audioUrl = extractAudioUrl(payload);
  if (audioUrl && !response.audioUrl) {
    response.audioUrl = audioUrl;
  }

  return {
    requestId,
    generator: overrides.generator || "elevenlabs",
    jobId,
    statusCode: overrides.statusCode,
    response
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let inputPayload = {};
  if (args.inputFile) {
    const fileText = await fs.readFile(args.inputFile, "utf8");
    inputPayload = safeJsonParse(fileText, {});
  } else {
    const stdinText = await readStdinText();
    if (stdinText) {
      inputPayload = safeJsonParse(stdinText, {});
    }
  }

  if (!inputPayload || typeof inputPayload !== "object" || Array.isArray(inputPayload)) {
    console.error("Input payload must be a JSON object.");
    process.exit(1);
  }

  const body = buildSaionCallbackPayload(inputPayload, args);

  if (!body.requestId) {
    console.error("Missing requestId. Provide --request-id or include requestId in input payload.");
    process.exit(1);
  }

  const headers = {
    "content-type": "application/json"
  };

  if (args.token) {
    headers["x-callback-token"] = args.token;
  }

  const response = await fetch(args.callbackUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const responseBodyText = await response.text();
  const responseBody = safeJsonParse(responseBodyText, { raw: responseBodyText });

  if (!response.ok) {
    console.error("Callback forward failed:", {
      status: response.status,
      body: responseBody
    });
    process.exit(1);
  }

  console.log("Callback forwarded to SAION.");
  console.log(JSON.stringify({
    requestId: body.requestId,
    callbackUrl: args.callbackUrl,
    status: response.status,
    response: responseBody
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message || "Unhandled callback adapter error.");
  process.exit(1);
});

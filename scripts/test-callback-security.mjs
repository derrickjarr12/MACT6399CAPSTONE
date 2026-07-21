import { spawn } from "node:child_process";
import crypto from "node:crypto";

const TEST_PORT = Number(process.env.CALLBACK_TEST_PORT || 3102);
const BASE_URL = `http://localhost:${TEST_PORT}`;
const CALLBACK_TOKEN = process.env.CALLBACK_TEST_TOKEN || "testtoken";
const SIGNING_SECRET = process.env.CALLBACK_TEST_SIGNING_SECRET || "testsecret";
const STRICT_MODE = String(process.env.CALLBACK_TEST_STRICT || "true").toLowerCase() !== "false";

function waitForServerReady(proc, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for server startup."));
    }, timeoutMs);

    const onData = (chunk) => {
      const text = String(chunk || "");
      if (text.includes("Server running at")) {
        cleanup();
        resolve();
      }
    };

    const onExit = (code) => {
      cleanup();
      reject(new Error(`Server exited before startup. Exit code: ${code}`));
    };

    const cleanup = () => {
      clearTimeout(timer);
      proc.stdout.off("data", onData);
      proc.stderr.off("data", onData);
      proc.off("exit", onExit);
    };

    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("exit", onExit);
  });
}

function signPayload(timestamp, payloadText) {
  return crypto.createHmac("sha256", SIGNING_SECRET).update(`${timestamp}.${payloadText}`).digest("hex");
}

async function postCallback({ payload, signature, timestamp }) {
  const response = await fetch(`${BASE_URL}/api/provider/callback`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-callback-token": CALLBACK_TOKEN,
      "x-elevenlabs-timestamp": String(timestamp),
      "x-elevenlabs-signature": signature
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return { status: response.status, data };
}

async function getRequestRecord(requestId) {
  const response = await fetch(`${BASE_URL}/api/provider/requests/${encodeURIComponent(requestId)}`);
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { status: response.status, data };
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const server = spawn("node", ["src/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      PROVIDER_DRY_RUN: "true",
      NOCODE_CALLBACK_TOKEN: CALLBACK_TOKEN,
      ELEVENLABS_REQUIRE_SIGNATURE: STRICT_MODE ? "true" : "false",
      ELEVENLABS_WEBHOOK_SIGNING_SECRET: SIGNING_SECRET
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  server.stdout.on("data", (chunk) => process.stdout.write(String(chunk)));
  server.stderr.on("data", (chunk) => process.stderr.write(String(chunk)));

  try {
    await waitForServerReady(server);

    const timestamp = Math.floor(Date.now() / 1000);

    const validPayload = {
      requestId: "req-valid-script",
      generator: "elevenlabs",
      jobId: "job-valid-script",
      statusCode: 200,
      response: {
        status: "completed",
        audioUrl: "https://example.com/audio-valid-script.mp3"
      }
    };

    const validPayloadText = JSON.stringify(validPayload);
    const validSignature = signPayload(timestamp, validPayloadText);

    const validResponse = await postCallback({
      payload: validPayload,
      signature: validSignature,
      timestamp
    });

    assertCondition(validResponse.status === 200, `Expected valid callback status 200, got ${validResponse.status}`);
    assertCondition(validResponse.data?.signature?.valid === true, "Expected valid callback signature.valid=true");

    const recordResponse = await getRequestRecord(validPayload.requestId);
    assertCondition(recordResponse.status === 200, `Expected request lookup status 200, got ${recordResponse.status}`);
    assertCondition(
      recordResponse.data?.audioUrl === validPayload.response.audioUrl,
      "Expected stored audioUrl to match callback audioUrl"
    );

    const invalidPayload = {
      requestId: "req-invalid-script",
      generator: "elevenlabs",
      jobId: "job-invalid-script",
      statusCode: 200,
      response: {
        status: "completed",
        audioUrl: "https://example.com/audio-invalid-script.mp3"
      }
    };

    const invalidResponse = await postCallback({
      payload: invalidPayload,
      signature: "deadbeef",
      timestamp
    });

    if (STRICT_MODE) {
      assertCondition(invalidResponse.status === 401, `Expected invalid callback status 401, got ${invalidResponse.status}`);
    } else {
      assertCondition(invalidResponse.status === 200, `Expected invalid callback status 200 in non-strict mode, got ${invalidResponse.status}`);
      assertCondition(invalidResponse.data?.signature?.valid === false, "Expected invalid callback signature.valid=false in non-strict mode");

      const invalidRecordResponse = await getRequestRecord(invalidPayload.requestId);
      assertCondition(invalidRecordResponse.status === 200, `Expected invalid callback request lookup status 200 in non-strict mode, got ${invalidRecordResponse.status}`);
      assertCondition(
        invalidRecordResponse.data?.audioUrl === invalidPayload.response.audioUrl,
        "Expected non-strict mode to persist invalid-signature callback payload"
      );
    }

    console.log("Callback security test passed.");
    console.log(
      JSON.stringify(
        {
          serverPort: TEST_PORT,
          strictMode: STRICT_MODE,
          checks: {
            validCallbackAccepted: true,
            requestRecordPersisted: true,
            invalidSignatureRejected: STRICT_MODE,
            invalidSignatureAcceptedInNonStrictMode: !STRICT_MODE
          }
        },
        null,
        2
      )
    );
  } finally {
    if (!server.killed) {
      server.kill("SIGTERM");
    }
  }
}

run().catch((error) => {
  console.error(`Callback security test failed: ${error.message}`);
  process.exit(1);
});

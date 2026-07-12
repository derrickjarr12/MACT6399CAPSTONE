import 'dotenv/config';

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.PROOF_BASE_URL || 'http://localhost:3000',
    generator: process.env.PROOF_GENERATOR || process.env.PREFERRED_PROVIDER || 'mureka',
    prompt: process.env.PROOF_PROMPT || 'Write a short uplifting chorus about moving forward.',
    poll: true,
    pollCount: Number(process.env.PROOF_POLL_COUNT || 12),
    pollIntervalMs: Number(process.env.PROOF_POLL_INTERVAL_MS || 4000),
    payload: {},
    compare: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--base' && next) {
      args.baseUrl = next;
      i += 1;
      continue;
    }

    if (token === '--generator' && next) {
      args.generator = next;
      i += 1;
      continue;
    }

    if (token === '--prompt' && next) {
      args.prompt = next;
      i += 1;
      continue;
    }

    if (token === '--payload' && next) {
      try {
        args.payload = JSON.parse(next);
      } catch {
        throw new Error('--payload must be valid JSON');
      }
      i += 1;
      continue;
    }

    if (token === '--compare' && next) {
      try {
        args.compare = JSON.parse(next);
      } catch {
        throw new Error('--compare must be valid JSON');
      }
      i += 1;
      continue;
    }

    if (token === '--no-poll') {
      args.poll = false;
      continue;
    }

    if (token === '--poll-count' && next) {
      args.pollCount = Number(next);
      i += 1;
      continue;
    }

    if (token === '--poll-interval' && next) {
      args.pollIntervalMs = Number(next);
      i += 1;
      continue;
    }
  }

  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJobId(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const candidates = [
    payload?._pnf?.providerJobId,
    payload?.jobId,
    payload?.job_id,
    payload?.data?.jobId,
    payload?.data?.job_id,
    payload?.result?.jobId,
    payload?.result?.job_id,
    payload?.id
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function extractStatus(payload) {
  if (!payload || typeof payload !== 'object') return 'unknown';
  return String(
    payload?._pnf?.normalizedStatus ||
      payload?.status ||
      payload?.state ||
      payload?.data?.status ||
      payload?.result?.status ||
      'unknown'
  ).toLowerCase();
}

function isTerminalStatus(status) {
  return ['completed', 'failed', 'error', 'cancelled', 'canceled', 'done', 'success', 'succeeded'].includes(status);
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { res, body };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.baseUrl.replace(/\/$/, '');

  console.log('Running provider proof check...');
  console.log(`- base: ${baseUrl}`);
  console.log(`- generator: ${args.generator}`);

  const generateUrl = `${baseUrl}/api/provider/generate`;
  const generatePayload = {
    generator: args.generator,
    prompt: args.prompt,
    payload: args.payload,
    ...(args.compare ? { compare: args.compare } : {})
  };

  const { res: genRes, body: genBody } = await fetchJson(generateUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(generatePayload)
  });

  const requestId = genBody?._pnf?.requestId || '';
  const jobId = extractJobId(genBody);

  console.log(`Generate HTTP status: ${genRes.status}`);
  if (!genRes.ok) {
    console.error('Generate failed:');
    console.error(JSON.stringify(genBody, null, 2));
    process.exit(1);
  }

  console.log(`requestId: ${requestId || '(none returned)'}`);
  console.log(`providerJobId: ${jobId || '(none returned)'}`);

  if (!args.poll || !jobId) {
    console.log('Proof run complete (no polling).');
    process.exit(0);
  }

  let lastBody = null;
  let terminal = false;

  for (let attempt = 1; attempt <= args.pollCount; attempt += 1) {
    const statusUrl = `${baseUrl}/api/provider/status/${encodeURIComponent(jobId)}?generator=${encodeURIComponent(args.generator)}${
      requestId ? `&requestId=${encodeURIComponent(requestId)}` : ''
    }`;

    const { res: statusRes, body: statusBody } = await fetchJson(statusUrl, { method: 'GET' });
    const normalizedStatus = extractStatus(statusBody);
    lastBody = statusBody;

    console.log(`Poll ${attempt}/${args.pollCount}: HTTP ${statusRes.status} status=${normalizedStatus}`);

    if (!statusRes.ok && statusRes.status !== 404) {
      console.error('Status polling failed:');
      console.error(JSON.stringify(statusBody, null, 2));
      process.exit(1);
    }

    if (isTerminalStatus(normalizedStatus)) {
      terminal = true;
      break;
    }

    if (attempt < args.pollCount) {
      await sleep(args.pollIntervalMs);
    }
  }

  if (!terminal) {
    console.error('Polling ended before terminal status was reached.');
    console.error(JSON.stringify(lastBody, null, 2));
    process.exit(2);
  }

  console.log('Proof run complete (terminal status reached).');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

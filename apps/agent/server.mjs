import http from "node:http";
import { Stagehand } from "@browserbasehq/stagehand";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8787);

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function normalizeModelName(modelName) {
  const raw = String(modelName || process.env.STAGEHAND_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  if (!raw) {
    return "google/gemini-2.5-flash";
  }
  return raw.includes("/") ? raw : `google/${raw}`;
}

function resolveGoogleApiKey() {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  ).trim();
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

async function executeStagehand(body) {
  const cdpUrl = String(body.cdpUrl || "").trim();
  const instruction = String(body.instruction || "").trim();
  const startUrl = String(body.startUrl || "").trim() || null;
  const maxSteps = Number(body.maxSteps || 20);
  const navigationTimeoutMs = Number(body.navigationTimeoutMs || 20_000);
  const waitBetweenActionsMs = Number(body.waitBetweenActionsMs || 0);
  const highlightCursor = body.highlightCursor !== false;
  const verbose = body.verbose ? 1 : 0;
  const modelName = normalizeModelName(body.modelName);
  const apiKey = resolveGoogleApiKey();

  if (!cdpUrl) {
    throw new Error("Missing cdpUrl.");
  }
  if (!instruction) {
    throw new Error("Missing instruction.");
  }
  if (!apiKey) {
    throw new Error("Missing Google API key for Stagehand.");
  }

  const stagehand = new Stagehand({
    env: "LOCAL",
    disableAPI: true,
    disablePino: true,
    verbose,
    model: {
      modelName,
      apiKey,
      waitBetweenActions: waitBetweenActionsMs,
    },
    localBrowserLaunchOptions: {
      cdpUrl,
      connectTimeoutMs: 10_000,
    },
  });

  try {
    await stagehand.init();

    let page = stagehand.context.pages()[0];
    if (!page) {
      page = await stagehand.context.newPage(startUrl || "about:blank");
    } else if (startUrl) {
      await page.goto(startUrl, {
        waitUntil: "domcontentloaded",
        timeoutMs: navigationTimeoutMs,
      });
    }

    const agent = stagehand.agent();
    const result = await agent.execute({
      instruction,
      maxSteps,
      page,
      highlightCursor,
    });

    return {
      success: result.success,
      completed: result.completed,
      message: result.message,
      actions: result.actions || [],
      usage: result.usage || null,
      url: page.url(),
      title: await page.title(),
    };
  } finally {
    await stagehand.close().catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && req.url === "/execute") {
      const body = await readJson(req);
      const payload = await executeStagehand(body);
      return json(res, 200, payload);
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[stagehand-agent]", message);
    return json(res, 500, { error: message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[stagehand-agent] listening on http://${HOST}:${PORT}`);
});

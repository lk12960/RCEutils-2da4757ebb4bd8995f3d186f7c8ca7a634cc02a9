// Use dynamic import to support node-fetch ESM from CommonJS
const fetch = (...args) => import("node-fetch").then(m => m.default(...args));
const FormData = require("form-data");

const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID || "9505117131";
const API_KEY = process.env.ROBLOX_API_KEY;
const GAMEPASS_LIMIT = Number(process.env.ROBLOX_GAMEPASS_LIMIT || 50);

function ensureEnv() {
  if (!API_KEY) throw new Error("ROBLOX_API_KEY missing");
  if (!UNIVERSE_ID) throw new Error("ROBLOX_UNIVERSE_ID missing");
}

async function listGamePasses(cursor = null) {
  ensureEnv();

  const url = new URL(
    `https://apis.roblox.com/game-passes/v1/universes/${UNIVERSE_ID}/game-passes`
  );
  url.searchParams.set("limit", "100");
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": API_KEY }
  });

  if (!res.ok) {
    throw new Error(`Failed to list game passes: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function createGamePass(name, price, description) {
  ensureEnv();

  const form = new FormData();
  form.append("name", String(name));
  form.append("price", String(price)); // MUST be string
  form.append("description", String(description || ""));
  form.append("isForSale", "true");

  const res = await fetch(
    `https://apis.roblox.com/game-passes/v1/universes/${UNIVERSE_ID}/game-passes`,
    {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        ...form.getHeaders() // REQUIRED (adds boundary)
      },
      body: form
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to create game pass: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function updateGamePass(passId, updates) {
  ensureEnv();

  const res = await fetch(
    `https://apis.roblox.com/game-passes/v1/game-passes/${passId}`,
    {
      method: "PATCH",
      headers: {
        "x-api-key": API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify(updates)
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to update game pass: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function ensureGamePassSlot(name, price, description) {
  let data = await listGamePasses();
  const collected = [...(data.data || [])];

  while (data.nextPageCursor) {
    data = await listGamePasses(data.nextPageCursor);
    collected.push(...(data.data || []));
    if (collected.length >= GAMEPASS_LIMIT) break;
  }

  if (collected.length < GAMEPASS_LIMIT) {
    const created = await createGamePass(name, price, description);
    const passId = created.id || created.passId || created.gamePassId;
    return { passId, created: true };
  }

  // Reuse first pass if limit reached
  const chosen = collected[0];
  const passId = chosen.id || chosen.passId || chosen.gamePassId;

  await updateGamePass(passId, {
    name: String(name),
    price: Number(price),
    description: String(description || ""),
    isForSale: true
  });

  return { passId, created: false };
}

function gamePassUrl(passId) {
  return `https://www.roblox.com/game-pass/${String(passId)}`;
}

module.exports = {
  UNIVERSE_ID,
  GAMEPASS_LIMIT,
  listGamePasses,
  createGamePass,
  updateGamePass,
  ensureGamePassSlot,
  gamePassUrl
};

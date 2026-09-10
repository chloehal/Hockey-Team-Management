import test from "node:test";
import assert from "node:assert/strict";
import { request } from "../src/lib/api.js";
test("les champs et actions restent compatibles avec PHP", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "api.php?action=save_training");
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), {
        date: "2026-09-10",
        presentIds: ["1"],
      });
      return { ok: true, json: async () => ({ ok: true }) };
    };
    await request("save_training", { date: "2026-09-10", presentIds: ["1"] });
  } finally {
    globalThis.fetch = original;
  }
});
test("une erreur HTTP JSON ou une page HTML ne devient pas un succès", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: "Accès refusé" }),
    });
    await assert.rejects(request("get_players"), /Accès refusé/);
    globalThis.fetch = async () => ({
      ok: false,
      json: async () => {
        throw Error("HTML");
      },
    });
    await assert.rejects(request("get_players"), /api.php/);
  } finally {
    globalThis.fetch = original;
  }
});

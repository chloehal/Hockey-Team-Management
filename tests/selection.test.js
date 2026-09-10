import test from "node:test";
import assert from "node:assert/strict";
import { selectMatch, scorePlayers } from "../src/lib/selection.js";
import { demoTeam } from "./fixtures.js";
test("la sélection ne modifie pas les fiches et conserve toutes les candidates", () => {
  const scored = scorePlayers(demoTeam.players, demoTeam.trainings),
    before = structuredClone(scored);
  const result = selectMatch(scored, demoTeam.trainings, 1);
  assert.deepEqual(scored, before);
  assert.ok(result.selected.length <= 16);
  assert.equal(
    result.selected.filter((p) => p.position_1 === "gardienne").length,
    1,
  );
  assert.equal(result.selected[0].id, 1);
  assert.equal(
    new Set(
      [...result.selected, ...result.deliberation, ...result.excluded].map(
        (p) => p.id,
      ),
    ).size,
    19,
  );
});
test("moins de seize joueuses et gardienne remplaçante", () => {
  const players = demoTeam.players
    .filter((p) => p.position_1 !== "gardienne")
    .slice(0, 8);
  const result = selectMatch(scorePlayers(players, []), [], players[0].id);
  assert.equal(result.selected.length, 8);
  assert.equal(result.selected[0].position_1, "gardienne");
  assert.equal(players[0].position_1, "defense_centrale");
  assert.equal(result.maxT3, 0);
});
test("les égalités restent à délibérer au lieu de choisir arbitrairement", () => {
  const players = Array.from({ length: 19 }, (_, i) => ({
    id: i + 1,
    name: `P${i}`,
    position_1: i === 0 ? "gardienne" : "defense_centrale",
    level: 2,
    pres3: 3,
    pres5: 5,
  }));
  const result = selectMatch(players, demoTeam.trainings, 1);
  assert.equal(result.selected.length, 1);
  assert.equal(result.deliberation.length, 18);
});
test("les présences utilisent la date et tolèrent les identifiants numériques PHP", () => {
  const trainings = [
    { date: "2026-09-05", presentIds: [1] },
    { date: "2026-09-01", presentIds: [] },
    { date: "2026-09-04", presentIds: ["1"] },
    { date: "2026-09-03", presentIds: [1] },
  ];
  assert.equal(scorePlayers([{ id: 1 }], trainings)[0].pres3, 3);
});

test("les sélections reproduisent les résultats de la version coach historique", async () => {
  const { readFile } = await import("node:fs/promises");
  const cases = JSON.parse(
    await readFile(
      new URL("./legacy-selection-cases.json", import.meta.url),
      "utf8",
    ),
  );
  for (const entry of cases) {
    const result = selectMatch(entry.scored, entry.trainings, entry.goalie);
    for (const key of ["selected", "deliberation", "excluded"])
      assert.deepEqual(
        result[key].map((p) => p.id),
        entry.expected[key],
      );
  }
});

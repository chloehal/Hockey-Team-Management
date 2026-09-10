import test from "node:test";
import assert from "node:assert/strict";
import {
  CRITERIA,
  emptyEvaluation,
  evaluationSummary,
  normalizeEvaluation,
} from "../src/lib/evaluations.js";
test("sept critères de même poids produisent une moyenne sur dix", () => {
  const scores = Object.fromEntries(CRITERIA.map(([key], i) => [key, i + 4]));
  assert.deepEqual(evaluationSummary(scores), { count: 7, average: 7 });
});
test("zéro est une note, une case vide reste non évaluée", () => {
  assert.deepEqual(evaluationSummary(emptyEvaluation()), {
    count: 0,
    average: null,
  });
  const scores = Object.fromEntries(CRITERIA.map(([key]) => [key, 0]));
  assert.equal(evaluationSummary(scores).average, 0);
  scores.technique = "";
  assert.deepEqual(evaluationSummary(scores), { count: 6, average: null });
});
test("refuse les valeurs hors barème et non numériques", () => {
  for (const invalid of [-1, 11, NaN, Infinity, "abc", true])
    assert.throws(() =>
      normalizeEvaluation({ ...emptyEvaluation(), technique: invalid }),
    );
  assert.equal(
    normalizeEvaluation({ ...emptyEvaluation(), technique: "8.5" }).technique,
    8.5,
  );
});

test("la moyenne départage les mêmes postes, sans pénaliser les fiches incomplètes", async () => {
  const { selectMatch } = await import("../src/lib/selection.js");
  const players = Array.from({ length: 18 }, (_, i) => ({
    id: i + 1,
    name: `J${i}`,
    position_1: i === 0 ? "gardienne" : "defense_centrale",
    pres3: 3,
    pres5: 5,
    level: 2,
  }));
  const evaluations = Object.fromEntries(
    players.map((p) => [
      p.id,
      Object.fromEntries(CRITERIA.map(([k]) => [k, p.id === 18 ? 10 : 5])),
    ]),
  );
  const result = selectMatch(players, [], 1, evaluations);
  assert.ok(result.selected.some((p) => p.id === 18));
  assert.equal(result.deliberation.length, 16);
  delete evaluations[2];
  const incomplete = selectMatch(players, [], 1, evaluations);
  assert.equal(incomplete.selected.length, 1);
  assert.equal(incomplete.deliberation.length, 17);
  players[17].pres3 = 2;
  const lowerAttendance = selectMatch(players, [], 1, evaluations);
  assert.ok(lowerAttendance.excluded.some((p) => p.id === 18));
});

test("une moyenne inférieure ne prend pas une place réservée au départage", async () => {
  const { selectMatch } = await import("../src/lib/selection.js");
  const players = Array.from({ length: 18 }, (_, i) => ({
    id: i + 1,
    name: `J${i}`,
    position_1:
      i === 0 ? "gardienne" : i < 15 ? "defense_centrale" : "attaquante_centre",
    pres3: i < 15 ? 3 : 2,
    pres5: 5,
    level: 2,
  }));
  const evaluations = Object.fromEntries(
    players.map((p) => [
      p.id,
      Object.fromEntries(CRITERIA.map(([k]) => [k, p.id === 18 ? 8 : 9])),
    ]),
  );
  const result = selectMatch(players, [], 1, evaluations);
  assert.equal(result.selected.length, 15);
  assert.deepEqual(
    result.deliberation.map((p) => p.id),
    [16, 17],
  );
  assert.deepEqual(
    result.excluded.map((p) => p.id),
    [18],
  );
});

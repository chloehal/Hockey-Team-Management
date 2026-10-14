import test from "node:test";
import assert from "node:assert/strict";
import * as selection from "../src/lib/selection.js";
import { CRITERIA } from "../src/lib/evaluations.js";
const p = (
  id,
  pres3,
  pres5 = pres3,
  position_1 = "defense_centrale",
  extra = {},
) => ({ id, name: `P${id}`, pres3, pres5, position_1, level: 2, ...extra });
const trainings = Array.from({ length: 5 }, () => ({}));
const formation = {
  field: { gardienne: 1, defense: 1 },
  bench: { defense: 1 },
};
test("les quotas séparent titulaires, remplaçantes et non-retenues en respectant les présences", () => {
  const players = [p(1, 0, 0, "gardienne"), p(2, 3, 5), p(3, 3, 4), p(4, 2, 5)];
  const before = structuredClone(players);
  const result = selection.selectMatch(
    players,
    trainings,
    1,
    undefined,
    formation,
  );
  assert.equal(result.selected.length, 3);
  assert.deepEqual(
    result.selected.map((p) => [p.id, p._zone]),
    [
      [1, "field"],
      [2, "field"],
      [3, "bench"],
    ],
  );
  assert.deepEqual(
    result.excluded.map((p) => p.id),
    [4],
  );
  assert.deepEqual(players, before);
});
test("les quotas invalides sont refusés y compris fractions et nombres négatifs", () => {
  for (const config of [
    { field: { gardienne: 1, defense: 11 }, bench: {} },
    { field: { gardienne: 1 }, bench: { defense: 6 } },
    { field: { gardienne: 1, defense: -1 }, bench: {} },
    { field: { gardienne: 1, defense: 1.5 }, bench: {} },
  ])
    assert.throws(() =>
      selection.selectMatch(
        [p(1, 0, 0, "gardienne")],
        trainings,
        1,
        undefined,
        config,
      ),
    );
});
test("une égalité pour une place reste à départager et ne profite pas à une joueuse moins présente", () => {
  const result = selection.selectMatch(
    [p(1, 0, 0, "gardienne"), p(2, 3, 5), p(3, 3, 5), p(4, 1, 2)],
    trainings,
    1,
    undefined,
    { field: { gardienne: 1, defense: 1 }, bench: {} },
  );
  assert.deepEqual(
    result.selected.map((p) => p.id),
    [1],
  );
  assert.deepEqual(result.deliberation.map((p) => p.id).sort(), [2, 3]);
  assert.deepEqual(
    result.excluded.map((p) => p.id),
    [4],
  );
});
test("les postes secondaires remplissent les places disponibles sans doublonner une joueuse", () => {
  const result = selection.selectMatch(
    [
      p(1, 0, 0, "gardienne"),
      p(2, 3, 5, "defense_centrale", { position_2: "milieu_centre" }),
      p(3, 2, 4),
    ],
    trainings,
    1,
    undefined,
    {
      field: { gardienne: 1, defense: 1, milieu: 1 },
      bench: {},
    },
  );
  assert.equal(result.selected.length, 3);
  assert.equal(result.selected.find((p) => p.id === 2)._fieldPos, "milieu");
  assert.equal(result.selected.find((p) => p.id === 3)._fieldPos, "defense");
});
test("une joueuse retenue par ses présences reste sélectionnée hors poste si nécessaire", () => {
  const result = selection.selectMatch(
    [p(1, 0, 0, "gardienne"), p(2, 3, 5)],
    trainings,
    1,
    undefined,
    { field: { gardienne: 1, attaque: 2 }, bench: {} },
  );
  assert.equal(result.selected.length, 2);
  assert.equal(result.selected.find((p) => p.id === 2)._fieldPos, "attaque");
  assert.equal(result.selected.find((p) => p.id === 2)._role, null);
  assert.equal(result.vacancies.find((v) => v.position === "attaque").count, 1);
});

test("les présences sont prioritaires sur les quotas même entre postes différents", () => {
  const players = [
    p(1, 0, 0, "gardienne"),
    p(2, 3, 5, "attaquante_centre"),
    p(3, 2, 3, "attaquante_aile", { name: "Sarah" }),
    p(4, 2, 3, "attaquante_centre", { name: "Fanny" }),
    p(5, 1, 3, "defense_laterale", { name: "Elise" }),
    p(6, 1, 3, "milieu_aile", { name: "Rosa" }),
  ];
  const config = {
    field: { gardienne: 1, attaque: 1, defense: 1 },
    bench: { milieu: 1 },
  };
  for (const input of [players, [...players].reverse()]) {
    const before = structuredClone(input);
    const result = selection.selectMatch(
      input,
      trainings,
      1,
      undefined,
      config,
    );
    assert.deepEqual(result.selected.map((p) => p.id).sort(), [1, 2, 3, 4]);
    assert.deepEqual(result.excluded.map((p) => p.id).sort(), [5, 6]);
    assert.equal(result.deliberation.length, 0);
    assert.equal(result.vacancies.length, 0);
    assert.deepEqual(input, before);
  }
});

test("les cinq dernières présences passent aussi avant un poste compatible et le niveau", () => {
  const result = selection.selectMatch(
    [
      p(1, 0, 0, "gardienne"),
      p(2, 2, 4, "attaquante_aile", { level: 3 }),
      p(3, 2, 3, "defense_centrale", { level: 1 }),
    ],
    trainings,
    1,
    undefined,
    { field: { gardienne: 1, defense: 1 }, bench: {} },
  );
  assert.deepEqual(
    result.selected.map((p) => p.id),
    [1, 2],
  );
  assert.deepEqual(
    result.excluded.map((p) => p.id),
    [3],
  );
});

test("une égalité globale réserve les places même si une moins présente couvre un poste vacant", () => {
  const result = selection.selectMatch(
    [
      p(1, 0, 0, "gardienne"),
      p(2, 3, 5, "attaquante_centre"),
      p(3, 3, 5, "attaquante_centre"),
      p(4, 1, 2),
    ],
    trainings,
    1,
    undefined,
    { field: { gardienne: 1, defense: 1 }, bench: {} },
  );
  assert.deepEqual(
    result.selected.map((p) => p.id),
    [1],
  );
  assert.deepEqual(result.deliberation.map((p) => p.id).sort(), [2, 3]);
  assert.deepEqual(
    result.excluded.map((p) => p.id),
    [4],
  );
});

test("les notes coach ne passent jamais devant les présences globales", () => {
  const players = [
    p(1, 0, 0, "gardienne"),
    p(2, 2, 4, "attaquante_aile"),
    p(3, 2, 3, "defense_centrale"),
  ];
  const evaluations = Object.fromEntries(
    players.map((player) => [
      player.id,
      Object.fromEntries(
        CRITERIA.map(([key]) => [key, player.id === 3 ? 10 : 0]),
      ),
    ]),
  );
  for (const notes of [evaluations, { 3: evaluations[3] }]) {
    const result = selection.selectMatch(players, trainings, 1, notes, {
      field: { gardienne: 1, defense: 1 },
      bench: {},
    });
    assert.deepEqual(
      result.selected.map((p) => p.id),
      [1, 2],
    );
    assert.deepEqual(
      result.excluded.map((p) => p.id),
      [3],
    );
  }
});

test("le placement puis le niveau départagent le seuil après réservation des meilleures présences", () => {
  const players = [
    p(1, 0, 0, "gardienne"),
    p(2, 3, 5, "attaquante_centre"),
    p(3, 2, 3, "defense_centrale", { level: 1 }),
    p(4, 2, 3, "defense_centrale", { level: 3 }),
  ];
  const config = { field: { gardienne: 1, defense: 2 }, bench: {} };
  for (const input of [players, [...players].reverse()]) {
    const result = selection.selectMatch(
      input,
      trainings,
      1,
      undefined,
      config,
    );
    assert.deepEqual(result.selected.map((p) => p.id).sort(), [1, 2, 3]);
    assert.equal(result.deliberation.length, 0);
    assert.deepEqual(
      result.excluded.map((p) => p.id),
      [4],
    );
  }
  const evaluations = Object.fromEntries(
    players.map((player) => [
      player.id,
      Object.fromEntries(
        CRITERIA.map(([key]) => [key, player.id === 4 ? 9 : 5]),
      ),
    ]),
  );
  const result = selection.selectMatch(
    players,
    trainings,
    1,
    evaluations,
    config,
  );
  assert.deepEqual(result.selected.map((p) => p.id).sort(), [1, 2, 4]);
  assert.equal(result.deliberation.length, 0);
});

test("à présences égales les notes hors poste exigent des évaluations complètes", () => {
  const players = [p(1, 0, 0, "gardienne"), p(2, 2, 3), p(3, 2, 3)];
  const evaluations = Object.fromEntries(
    players.map((player) => [
      player.id,
      Object.fromEntries(
        CRITERIA.map(([key]) => [key, player.id === 3 ? 9 : 5]),
      ),
    ]),
  );
  const config = { field: { gardienne: 1, attaque: 1 }, bench: {} };
  const complete = selection.selectMatch(
    players,
    trainings,
    1,
    evaluations,
    config,
  );
  assert.deepEqual(
    complete.selected.map((p) => p.id),
    [1, 3],
  );
  delete evaluations[2];
  const incomplete = selection.selectMatch(
    players,
    trainings,
    1,
    evaluations,
    config,
  );
  assert.deepEqual(
    incomplete.selected.map((p) => p.id),
    [1],
  );
  assert.deepEqual(incomplete.deliberation.map((p) => p.id).sort(), [2, 3]);
});
test("les déplacements gardent le banc dans la sélection et bloquent une place pleine", () => {
  const result = selection.selectMatch(
    [p(1, 0, 0, "gardienne"), p(2, 3, 5), p(3, 2, 4), p(4, 1, 1)],
    trainings,
    1,
    undefined,
    formation,
  );
  assert.throws(() => selection.moveMatchPlayer(result, 4, "bench", "defense"));
  const removed = selection.moveMatchPlayer(result, 3, "excluded");
  const moved = selection.moveMatchPlayer(removed, 2, "bench", "defense");
  assert.equal(moved.selected.find((p) => p.id === 2)._zone, "bench");
  assert.equal(moved.selected.length, 2);
  assert.equal(result.selected.length, 3);
  assert.throws(() => selection.moveMatchPlayer(moved, 4, "field", "attaque"));
});

test("la répartition utilise quatre groupes et accepte toutes leurs spécialités", () => {
  const result = selection.selectMatch(
    [
      p(1, 0, 0, "gardienne"),
      p(2, 3, 5, "defense_centrale"),
      p(3, 2, 4, "defense_laterale"),
      p(4, 3, 5, "milieu_aile"),
      p(5, 3, 5, "attaquante_centre"),
    ],
    trainings,
    1,
    undefined,
    { field: { gardienne: 1, defense: 2, milieu: 1, attaque: 1 }, bench: {} },
  );
  assert.equal(result.selected.length, 5);
  assert.deepEqual(
    result.selected.filter((p) => p._fieldPos === "defense").map((p) => p.id),
    [2, 3],
  );
});

test("à présences égales les rôles précis équilibrent la défense avant le niveau", () => {
  const players = [
    p(1, 0, 0, "gardienne"),
    p(2, 3, 5),
    p(3, 2, 4, "defense_centrale", { level: 1 }),
    p(4, 2, 4, "defense_laterale", { level: 3 }),
  ];
  for (const input of [players, [...players].reverse()]) {
    const result = selection.selectMatch(input, trainings, 1, undefined, {
      field: { gardienne: 1, defense: 2 },
      bench: {},
    });
    assert.deepEqual(result.selected.map((p) => p.id).sort(), [1, 2, 4]);
    assert.equal(
      result.selected.find((p) => p.id === 4)._role,
      "defense_laterale",
    );
  }
});
test("un rôle précis secondaire peut compléter la composition sans changer le quota", () => {
  const result = selection.selectMatch(
    [
      p(1, 0, 0, "gardienne"),
      p(2, 3, 5),
      p(3, 2, 4, "defense_centrale", { position_2: "defense_laterale" }),
      p(4, 2, 4),
    ],
    trainings,
    1,
    undefined,
    { field: { gardienne: 1, defense: 2 }, bench: {} },
  );
  assert.equal(
    result.selected.find((p) => p.id === 3)._role,
    "defense_laterale",
  );
  assert.equal(result.selected.length, 3);
});
test("les rôles précis ne passent pas devant les présences", () => {
  const result = selection.selectMatch(
    [
      p(1, 0, 0, "gardienne"),
      p(2, 3, 5),
      p(3, 3, 4),
      p(4, 2, 5, "defense_laterale"),
    ],
    trainings,
    1,
    undefined,
    { field: { gardienne: 1, defense: 2 }, bench: {} },
  );
  assert.deepEqual(
    result.selected.map((p) => p.id),
    [1, 2, 3],
  );
});
test("les spécialités rares sont couvertes et les vraies égalités restent manuelles", () => {
  const result = selection.selectMatch(
    [
      p(1, 0, 0, "gardienne"),
      p(2, 3, 5),
      p(3, 3, 5),
      p(4, 3, 5, "defense_laterale"),
    ],
    trainings,
    1,
    undefined,
    { field: { gardienne: 1, defense: 2 }, bench: {} },
  );
  assert.deepEqual(
    result.selected.map((p) => p.id),
    [1, 4],
  );
  assert.deepEqual(
    result.deliberation.map((p) => p.id),
    [2, 3],
  );
});

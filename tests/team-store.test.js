import test from "node:test";
import assert from "node:assert/strict";
import { createTeamStore } from "../src/lib/team-store.js";
const initial = {
  players: [
    { id: 1, name: "A" },
    { id: 2, name: "B" },
  ],
  trainings: [],
  messages: [],
  notes: [],
  referees: [],
};
function setup() {
  const values = new Map([
    ["pantheres-react-team-v1", JSON.stringify(initial)],
  ]);
  const storage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
  const pending = new Map(),
    writes = [];
  const request = (action, payload) => {
    if (payload) {
      writes.push({ action, payload });
      return new Promise((resolve, reject) =>
        pending.set(action, { resolve, reject }),
      );
    }
    return new Promise((resolve, reject) =>
      pending.set(action, { resolve, reject }),
    );
  };
  const store = createTeamStore({ request, storage });
  const resolveReads = () => {
    for (const [key, value] of Object.entries(initial))
      pending
        .get(
          {
            players: "get_players",
            trainings: "get_trainings",
            messages: "get_important_msg",
            notes: "get_notes",
            referees: "get_referees",
          }[key],
        )
        ?.resolve(value);
  };
  return { store, pending, writes, storage, request, resolveReads };
}
test("le cache et le brouillon sont disponibles avant la réponse serveur", () => {
  const { store, storage, request } = setup();
  assert.equal(store.getSnapshot().data.players.length, 2);
  store.setAttendanceDate("2026-09-27");
  store.setAttendanceSelected(["1"]);
  const restored = createTeamStore({ request, storage });
  assert.deepEqual(restored.getSnapshot().attendanceDraft.selected, ["1"]);
});
test("enregistrer pendant le chargement attend les présences puis envoie une seule fois", async () => {
  const { store, pending, writes, resolveReads } = setup();
  store.refresh();
  store.setAttendanceDate("2026-09-27");
  store.setAttendanceSelected(["1"]);
  const saving = store.saveAttendance();
  assert.equal(store.getSnapshot().attendanceStatus, "waiting");
  assert.equal(writes.length, 0);
  resolveReads();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(writes.length, 1);
  assert.equal(store.getSnapshot().attendanceStatus, "saving");
  assert.deepEqual(writes[0].payload, {
    date: "2026-09-27",
    presentIds: ["1"],
  });
  pending.get("save_training").resolve({ id: 9 });
  await saving;
  assert.equal(store.getSnapshot().attendanceStatus, "success");
  assert.deepEqual(store.getSnapshot().data.trainings[0].presentIds, ["1"]);
});
test("un échec serveur conserve la saisie sans annoncer de succès", async () => {
  const { store, pending, resolveReads } = setup();
  const loading = store.refresh();
  resolveReads();
  await loading;
  store.setAttendanceSelected(["2"]);
  const saving = store.saveAttendance();
  await new Promise((resolve) => setImmediate(resolve));
  pending.get("save_training").reject(new Error("Serveur indisponible"));
  await saving;
  assert.equal(store.getSnapshot().attendanceStatus, "error");
  assert.deepEqual(store.getSnapshot().attendanceDraft.selected, ["2"]);
});
test("un rafraîchissement fusionne les changements serveur sans écraser les cases touchées", async () => {
  const { store, pending, resolveReads } = setup();
  store.setAttendanceDate("2026-09-27");
  store.setAttendanceSelected(["1"]);
  const loading = store.refresh();
  pending
    .get("get_trainings")
    .resolve([{ id: 1, date: "2026-09-27", presentIds: ["2"] }]);
  resolveReads();
  await loading;
  assert.deepEqual(store.getSnapshot().attendanceDraft.selected.sort(), [
    "1",
    "2",
  ]);
});
test("les autres ressources lentes ne bloquent pas l’enregistrement des présences", async () => {
  const { store, pending, writes } = setup();
  store.refresh();
  store.setAttendanceSelected(["1"]);
  const saving = store.saveAttendance();
  pending.get("get_players").resolve(initial.players);
  pending.get("get_trainings").resolve([]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(writes.length, 1);
  pending.get("save_training").resolve({ id: 4 });
  await saving;
  assert.equal(store.getSnapshot().attendanceStatus, "success");
});
test("un double clic ne duplique pas la sauvegarde", async () => {
  const { store, pending, writes, resolveReads } = setup();
  store.refresh();
  store.setAttendanceSelected(["1"]);
  const first = store.saveAttendance(),
    second = store.saveAttendance();
  resolveReads();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(writes.length, 1);
  pending.get("save_training").resolve({ id: 2 });
  await Promise.all([first, second]);
});

test("une validation refusée permet de corriger la date puis de réessayer", async () => {
  const { store, pending, writes, resolveReads } = setup();
  const loading = store.refresh();
  resolveReads();
  await loading;
  store.setAttendanceDate("");
  await store.saveAttendance();
  assert.equal(store.getSnapshot().attendanceStatus, "error");
  store.setAttendanceDate("2026-09-27");
  store.setAttendanceSelected(["1"]);
  const saving = store.saveAttendance();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(writes.length, 1);
  pending.get("save_training").resolve({ id: 7 });
  await saving;
  assert.equal(store.getSnapshot().attendanceStatus, "success");
});

import { emptyTeam, request as apiRequest } from "./api.js";
const CACHE = "pantheres-react-team-v1";
const DRAFT = "pantheres-attendance-draft-v1";
const resources = {
  players: "get_players",
  trainings: "get_trainings",
  messages: "get_important_msg",
  notes: "get_notes",
  referees: "get_referees",
};
const localDate = () => new Date().toLocaleDateString("sv-SE");
const pendingStatus = (status) => status === "waiting" || status === "saving";
export function createTeamStore({ request = apiRequest, storage } = {}) {
  function read(key) {
    try {
      return JSON.parse(storage?.getItem(key) || "null");
    } catch {
      return null;
    }
  }
  function write(key, value) {
    try {
      storage?.setItem(key, JSON.stringify(value));
    } catch {}
  }
  const cache = read(CACHE);
  const validCache =
    cache &&
    Object.keys(emptyTeam).every((key) => Array.isArray(cache[key])) &&
    cache.trainings.every((t) => Array.isArray(t.presentIds));
  const savedDraft = read(DRAFT);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(savedDraft?.date || "")
    ? savedDraft.date
    : localDate();
  let state = {
    data: validCache ? cache : structuredClone(emptyTeam),
    loading: true,
    hasCachedData: Boolean(validCache),
    hasPlayers: Boolean(validCache),
    presenceReady: false,
    error: "",
    offline: false,
    busy: false,
    notice: "",
    attendanceStatus: "idle",
    attendanceError: "",
    attendanceDraft: {
      date,
      selected: [],
      overrides:
        savedDraft?.date === date &&
        savedDraft.overrides &&
        typeof savedDraft.overrides === "object" &&
        !Array.isArray(savedDraft.overrides)
          ? savedDraft.overrides
          : {},
    },
  };
  const listeners = new Set();
  let refreshPromise = null,
    presencePromise = null,
    savingPromise = null;
  const emit = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  function rebaseDraft(data = state.data) {
    const draft = state.attendanceDraft;
    const selected = new Set(
      (data.trainings.find((t) => t.date === draft.date)?.presentIds || []).map(
        String,
      ),
    );
    for (const [id, present] of Object.entries(draft.overrides)) {
      if (present) selected.add(id);
      else selected.delete(id);
    }
    const validIds = new Set(data.players.map((p) => String(p.id)));
    return {
      ...draft,
      selected: [...selected].filter(
        (id) => !state.hasPlayers || validIds.has(id),
      ),
    };
  }
  state.attendanceDraft = rebaseDraft();
  function persist() {
    write(CACHE, state.data);
    write(DRAFT, state.attendanceDraft);
  }
  function refresh() {
    if (refreshPromise) return refreshPromise;
    emit({ loading: true, presenceReady: false, error: "" });
    const jobs = Object.fromEntries(
      Object.entries(resources).map(([key, action]) => [
        key,
        (async () => {
          const rows = await request(action);
          if (
            !Array.isArray(rows) ||
            (key === "trainings" &&
              rows.some((t) => !Array.isArray(t.presentIds)))
          )
            throw new Error("Données de l’équipe invalides.");
          const data = { ...state.data, [key]: rows };
          if (key === "players") emit({ hasPlayers: true });
          emit({ data });
          if (key === "players" || key === "trainings")
            emit({ attendanceDraft: rebaseDraft(data) });
          persist();
          return rows;
        })(),
      ]),
    );
    presencePromise = Promise.all([jobs.players, jobs.trainings]).then(
      () => {
        emit({ presenceReady: true });
        return true;
      },
      () => false,
    );
    refreshPromise = Promise.allSettled(Object.values(jobs))
      .then((results) => {
        const failure = results.find((r) => r.status === "rejected");
        emit({
          loading: false,
          hasCachedData: true,
          offline: Boolean(failure),
          error: failure?.reason?.message || "",
        });
        return !failure;
      })
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  }
  function setAttendanceDate(date) {
    if (pendingStatus(state.attendanceStatus)) return;
    emit({
      attendanceDraft: { date, selected: [], overrides: {} },
      attendanceStatus: "idle",
      attendanceError: "",
    });
    emit({ attendanceDraft: rebaseDraft() });
    persist();
  }
  function setAttendanceSelected(selected) {
    if (pendingStatus(state.attendanceStatus)) return;
    const next = new Set(selected.map(String)),
      previous = new Set(state.attendanceDraft.selected);
    const overrides = { ...state.attendanceDraft.overrides };
    for (const id of new Set([...next, ...previous]))
      if (next.has(id) !== previous.has(id)) overrides[id] = next.has(id);
    emit({
      attendanceDraft: {
        ...state.attendanceDraft,
        selected: [...next],
        overrides,
      },
      attendanceStatus: "idle",
      attendanceError: "",
    });
    persist();
  }
  function saveAttendance() {
    if (savingPromise) return savingPromise;
    if (state.busy) {
      emit({
        attendanceStatus: "error",
        attendanceError:
          "Une autre sauvegarde est en cours. Réessaie dans un instant.",
      });
      return Promise.resolve();
    }
    emit({
      busy: true,
      notice: "",
      attendanceError: "",
      attendanceStatus: state.presenceReady ? "saving" : "waiting",
    });
    savingPromise = (async () => {
      try {
        if (!state.presenceReady) {
          if (!refreshPromise) refresh();
          const ready = await presencePromise;
          if (!ready)
            throw new Error(
              "Impossible de charger les présences. Ta saisie est conservée. Réessaie quand la connexion revient.",
            );
        }
        const { date, selected } = state.attendanceDraft;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
          throw new Error("Choisis une date valide.");
        if (!state.hasPlayers || !state.data.players.length)
          throw new Error("Aucune joueuse disponible pour le pointage.");
        emit({ attendanceStatus: "saving" });
        const payload = { date, presentIds: [...selected] };
        const response = await request("save_training", payload);
        const existing = state.data.trainings.find((t) => t.date === date);
        const training = {
          ...payload,
          id: response.id ?? existing?.id ?? `saved-${date}`,
        };
        const data = {
          ...state.data,
          trainings: [
            ...state.data.trainings.filter((t) => t.date !== date),
            training,
          ].sort((a, b) => a.date.localeCompare(b.date)),
        };
        emit({
          data,
          attendanceDraft: { date, selected: [...selected], overrides: {} },
          attendanceStatus: "success",
          attendanceError: "",
          notice: "Présences enregistrées.",
        });
        persist();
      } catch (error) {
        emit({ attendanceStatus: "error", attendanceError: error.message });
      } finally {
        emit({ busy: false });
      }
    })().finally(() => {
      savingPromise = null;
    });
    return savingPromise;
  }
  async function mutate(action, payload) {
    if (state.busy) throw new Error("Une sauvegarde est déjà en cours.");
    emit({ busy: true, notice: "" });
    try {
      if (refreshPromise) await refreshPromise;
      await request(action, payload);
      const refreshed = await refresh();
      emit({
        notice: refreshed
          ? "Enregistré."
          : "Enregistré sur le serveur. Actualise pour voir les dernières données.",
      });
    } finally {
      emit({ busy: false });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    refresh,
    mutate,
    setAttendanceDate,
    setAttendanceSelected,
    saveAttendance,
    resetAttendanceStatus: () => {
      if (!pendingStatus(state.attendanceStatus))
        emit({ attendanceStatus: "idle", attendanceError: "" });
    },
  };
}
let singleton;
export function getTeamStore() {
  if (!singleton) {
    let storage;
    try {
      storage = globalThis.localStorage;
    } catch {}
    singleton = createTeamStore({ storage });
  }
  return singleton;
}

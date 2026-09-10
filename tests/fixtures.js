import { normalizeEvaluation } from "../src/lib/evaluations.js";
export const demoTeam = {
  players: Array.from({ length: 19 }, (_, i) => ({
    id: i + 1,
    name: [
      "Alice Martin",
      "Camille Dubois",
      "Emma Laurent",
      "Louise Simon",
      "Jade Moreau",
      "Lina Petit",
      "Rose Thomas",
      "Chloé Robert",
      "Mia Bernard",
      "Anna Lambert",
      "Sarah Michel",
      "Eva Dupont",
      "Zoé Leroy",
      "Nina Leclerc",
      "Léa Girard",
      "Inès Roux",
      "Clara Denis",
      "Julie Noël",
      "Manon Henry",
    ][i],
    number: String(i + 1),
    position_1: [
      "gardienne",
      "defense_centrale",
      "defense_laterale",
      "milieu_centre",
      "milieu_aile",
      "attaquante_centre",
      "attaquante_aile",
    ][i % 7],
    position_2: "milieu_aile",
    position_3: null,
    level: (i % 3) + 1,
  })),
  trainings: Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    date: `2026-09-0${i + 1}`,
    presentIds: Array.from({ length: 19 }, (_, j) => String(j + 1)).filter(
      (_, j) => (i + j) % 5 !== 0,
    ),
  })),
  messages: [
    {
      id: 1,
      title: "Rendez-vous sur le terrain",
      text: "Pense à compléter tes disponibilités pour la prochaine rencontre.",
      icon: "info",
    },
  ],
  notes: [{ id: 1, text: "Préparer les maillots pour dimanche." }],
  referees: [{ id: 1, date: "2026-09-20", name: "Arbitre démo", phone: "" }],
};
export function demoResponse(data, action, input) {
  const getters = {
    get_players: "players",
    get_trainings: "trainings",
    get_important_msg: "messages",
    get_notes: "notes",
    get_referees: "referees",
  };
  if (
    action === "get_player_evaluations" ||
    action === "save_player_evaluation"
  ) {
    if (input.password !== "demo")
      return { error: "Accès coach requis pour les évaluations." };
    data.evaluations ||= {};
    if (action === "get_player_evaluations") return data.evaluations;
    if (!data.players.some((p) => p.id === input.id))
      return { error: "Joueuse introuvable" };
    try {
      const scores = normalizeEvaluation(input.scores);
      data.evaluations[input.id] = scores;
      return { ok: true, scores };
    } catch (error) {
      return { error: error.message };
    }
  }
  if (getters[action]) return data[getters[action]];
  if (action === "verify_coach_password")
    return { ok: input.password === "demo" };
  if (action === "save_training") {
    let t = data.trainings.find((t) => t.date === input.date);
    if (t) t.presentIds = input.presentIds;
    else data.trainings.push({ ...input, id: Date.now() });
    return { ok: true };
  }
  if (action === "update_player_details") {
    Object.assign(
      data.players.find((p) => p.id === input.id),
      input,
    );
    return { ok: true };
  }
  const mapping = {
    add_player: "players",
    add_note: "notes",
    save_important_msg: "messages",
    add_referee: "referees",
    delete_player: "players",
    delete_note: "notes",
    delete_important_msg: "messages",
    delete_referee: "referees",
    delete_training: "trainings",
  };
  if (mapping[action]) {
    const key = mapping[action];
    if (action.startsWith("delete"))
      data[key] = data[key].filter((p) => p.id !== input.id);
    else {
      if (
        key === "referees" &&
        data[key].filter((r) => r.date === input.date).length >= 2
      )
        return { error: "Déjà 2 arbitres pour cette date" };
      data[key].push({ ...input, id: Date.now() });
    }
    return { ok: true };
  }
  return { error: "Action non disponible dans la démonstration" };
}

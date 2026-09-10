const resources = {
  players: "get_players",
  trainings: "get_trainings",
  messages: "get_important_msg",
  notes: "get_notes",
  referees: "get_referees",
};
export async function request(action, data) {
  const response = await fetch(
    `api.php?action=${encodeURIComponent(action)}`,
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
  );
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "Le serveur ne renvoie pas de données valides. Vérifie la publication de api.php.",
    );
  }
  if (!response.ok || result?.error)
    throw new Error(result?.error || `Erreur serveur (${response.status}).`);
  return result;
}
export async function loadTeam() {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(resources).map(async ([key, action]) => {
        const rows = await request(action);
        if (
          !Array.isArray(rows) ||
          (key === "trainings" &&
            rows.some((t) => !Array.isArray(t.presentIds)))
        )
          throw new Error("Données de l’équipe invalides.");
        return [key, rows];
      }),
    ),
  );
}
export const emptyTeam = {
  players: [],
  trainings: [],
  messages: [],
  notes: [],
  referees: [],
};

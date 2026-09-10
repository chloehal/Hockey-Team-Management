export const CRITERIA = [
  ["technique", "Technique"],
  ["physique", "Physique"],
  ["strategie", "Stratégie"],
  ["placement", "Placement"],
  ["esprit_equipe", "Esprit d’équipe"],
  ["puissance", "Puissance"],
  ["precision", "Précision"],
];
export const emptyEvaluation = () =>
  Object.fromEntries(CRITERIA.map(([key]) => [key, null]));
export function normalizeEvaluation(values) {
  return Object.fromEntries(
    CRITERIA.map(([key, label]) => {
      const raw = values[key];
      if (raw === "" || raw === null || raw === undefined) return [key, null];
      if (typeof raw !== "number" && typeof raw !== "string")
        throw new Error(`${label} : saisis une note entre 0 et 10.`);
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 10)
        throw new Error(`${label} : saisis une note entre 0 et 10.`);
      return [key, value];
    }),
  );
}
export function evaluationSummary(values) {
  const scores = normalizeEvaluation(values);
  const filled = Object.values(scores).filter((v) => v !== null);
  return {
    count: filled.length,
    average:
      filled.length === CRITERIA.length
        ? filled.reduce((a, b) => a + b, 0) / CRITERIA.length
        : null,
  };
}

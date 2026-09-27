import { evaluationSummary } from "./evaluations.js";
export const POS_LABELS = {
  gardienne: "G",
  defense_centrale: "DC",
  defense_laterale: "DL",
  milieu_centre: "MC",
  milieu_aile: "MA",
  attaquante_centre: "AC",
  attaquante_aile: "AA",
};
export const POS_FULL_LABELS = {
  gardienne: "Gardienne",
  defense_centrale: "Def. centrale",
  defense_laterale: "Def. laterale",
  milieu_centre: "Milieu centre",
  milieu_aile: "Milieu aile",
  attaquante_centre: "Att. centre",
  attaquante_aile: "Att. aile",
};
export const POS_GROUPS = {
  gardienne: "gardienne",
  defense_centrale: "defense",
  defense_laterale: "defense",
  milieu_centre: "milieu",
  milieu_aile: "milieu",
  attaquante_centre: "attaque",
  attaquante_aile: "attaque",
};
export const GROUP_LABELS = {
  gardienne: "Gardienne",
  defense: "Défense",
  milieu: "Milieu",
  attaque: "Attaque",
};
export const POS_MINIMUMS = { gardienne: 1, defense: 5, milieu: 5, attaque: 3 };
export const POS_MAXIMUMS = {
  gardienne: 1,
  defense_centrale: 3,
  defense_laterale: 3,
  milieu_centre: 3,
  milieu_aile: 3,
  attaquante_centre: 3,
  attaquante_aile: 3,
};
export const GROUP_MAXIMUMS = {
  gardienne: 1,
  defense: 5,
  milieu: 5,
  attaque: 3,
};

function posLabel(p) {
  return POS_LABELS[p.position_1] || "?";
}

function isGoalkeeper(p) {
  return p.position_1 === "gardienne";
}

export function selectMatch(
  input,
  trainings,
  chosenGoalieId,
  evaluations,
  formation,
) {
  if (formation)
    return selectFormation(
      input,
      trainings,
      chosenGoalieId,
      evaluations,
      formation,
    );
  const scored = input.map((p) => ({ ...p }));
  const maxT3 = Math.min(3, trainings.length),
    maxT5 = Math.min(5, trainings.length);
  const goalkeepers = scored.filter((p) => isGoalkeeper(p));
  const chosen = scored.find((p) => p.id === chosenGoalieId);
  const nonGoalkeepers = scored.filter(
    (p) => !isGoalkeeper(p) && (!chosen || p.id !== chosen.id),
  );

  let selected = [],
    deliberation = [],
    excluded = [];

  const filledByPos = {};
  for (const pos in POS_MAXIMUMS) filledByPos[pos] = 0;
  const filledByGroup = { gardienne: 0, defense: 0, milieu: 0, attaque: 0 };

  function countPlayer(p) {
    const pos1 = p.position_1;
    if (pos1 && filledByPos.hasOwnProperty(pos1)) filledByPos[pos1]++;
    const grp = pos1 && POS_GROUPS[pos1];
    if (grp) filledByGroup[grp]++;
  }

  function wouldExceedMax(p) {
    const pos1 = p.position_1;
    if (
      pos1 &&
      POS_MAXIMUMS[pos1] !== undefined &&
      filledByPos[pos1] >= POS_MAXIMUMS[pos1]
    )
      return "pos";
    const grp = pos1 && POS_GROUPS[pos1];
    if (
      grp &&
      GROUP_MAXIMUMS[grp] !== undefined &&
      filledByGroup[grp] >= GROUP_MAXIMUMS[grp]
    )
      return "group";
    return false;
  }

  // Gardienne choisie par le coach (peut etre une remplacante)
  if (chosen) {
    const isReplacement = !isGoalkeeper(chosen);
    const goalieEntry = isReplacement
      ? { ...chosen, _originalPos: chosen.position_1, position_1: "gardienne" }
      : { ...chosen };
    goalieEntry._reason = isReplacement
      ? "Remplacante au poste de gardienne (choisie par le coach)."
      : "Gardienne — choisie par le coach (niveau " +
        (chosen.level || 2) +
        ").";
    selected.push(goalieEntry);
    filledByPos["gardienne"] = 1;
    filledByGroup["gardienne"] = 1;
    // Exclure les autres gardiennes de metier
    for (const g of goalkeepers) {
      if (g.id !== chosen.id) {
        g._reason = "Gardienne non selectionnee (une autre a ete choisie).";
        excluded.push(g);
      }
    }
  }

  // Trier le reste par presences
  nonGoalkeepers.sort((a, b) => {
    if (b.pres3 !== a.pres3) return b.pres3 - a.pres3;
    return b.pres5 - a.pres5;
  });

  const spotsTotal = 16 - selected.length; // 15 places restantes

  if (nonGoalkeepers.length <= spotsTotal) {
    nonGoalkeepers.forEach((p) => {
      p._reason = "Moins de 16 joueuses, toutes selectionnees.";
    });
    nonGoalkeepers.forEach(countPlayer);
    selected.push(...nonGoalkeepers);
  } else {
    const cutoff = nonGoalkeepers[spotsTotal - 1];
    const cutPres3 = cutoff.pres3,
      cutPres5 = cutoff.pres5;
    const above = [],
      tied = [],
      below = [];

    for (const p of nonGoalkeepers) {
      if (p.pres3 > cutPres3 || (p.pres3 === cutPres3 && p.pres5 > cutPres5))
        above.push(p);
      else if (p.pres3 === cutPres3 && p.pres5 === cutPres5) tied.push(p);
      else below.push(p);
    }

    above.forEach((p) => {
      p._reason =
        "Presences superieures (" +
        p.pres3 +
        "/" +
        maxT3 +
        ", " +
        p.pres5 +
        "/" +
        maxT5 +
        ").";
    });
    above.forEach(countPlayer);
    selected.push(...above);

    const spotsLeft = spotsTotal - above.length;

    if (tied.length <= spotsLeft) {
      tied.forEach((p) => {
        p._reason =
          "A egalite (" +
          p.pres3 +
          "/" +
          maxT3 +
          ", " +
          p.pres5 +
          "/" +
          maxT5 +
          "), toutes tiennent dans les places restantes.";
      });
      tied.forEach(countPlayer);
      selected.push(...tied);
      below.forEach((p) => {
        p._reason =
          "Presences insuffisantes (" +
          p.pres3 +
          "/" +
          maxT3 +
          ", " +
          p.pres5 +
          "/" +
          maxT5 +
          ") par rapport au seuil (" +
          cutPres3 +
          "/" +
          maxT3 +
          ", " +
          cutPres5 +
          "/" +
          maxT5 +
          ").";
      });
      excluded.push(...below);
    } else {
      const remainingNeeds = {};
      for (const grp in POS_MINIMUMS)
        remainingNeeds[grp] = Math.max(
          0,
          POS_MINIMUMS[grp] - filledByGroup[grp],
        );

      function computeScore(p) {
        const exceed = wouldExceedMax(p);
        if (exceed) return { score: -1000, exceed };
        let posScore = 0;
        for (const slot of [
          { key: "position_1", weight: 3 },
          { key: "position_2", weight: 2 },
          { key: "position_3", weight: 1 },
        ]) {
          const pos = p[slot.key];
          const grp = pos && POS_GROUPS[pos];
          if (grp && remainingNeeds[grp] > 0) posScore += slot.weight;
        }
        const levelScore = evaluations ? 0 : 3 - (p.level || 2);
        let specificNeed = 0;
        if (p.position_1 && POS_MAXIMUMS[p.position_1] !== undefined) {
          specificNeed =
            POS_MAXIMUMS[p.position_1] - (filledByPos[p.position_1] || 0);
        }
        return {
          score: posScore * 1000 + levelScore * 100 + specificNeed * 10,
          exceed: false,
        };
      }

      for (const p of tied) {
        const { score, exceed } = computeScore(p);
        p._score = score;
        p._exceed = exceed;
      }
      if (evaluations) {
        // Only compare complete evaluations within the same composition priority.
        // An unevaluated player is never assigned an invented zero.
        const groups = new Map();
        for (const p of tied)
          groups.set(p._score, [...(groups.get(p._score) || []), p]);
        for (const group of groups.values()) {
          const averages = group.map(
            (p) => evaluationSummary(evaluations[p.id] || {}).average,
          );
          if (averages.every((average) => average !== null)) {
            group.forEach((p, index) => {
              p._score += averages[index] / 100;
              p._evaluationAverage = averages[index];
            });
          }
        }
      }
      tied.sort((a, b) => b._score - a._score);

      let spotsRemaining = spotsLeft;
      let i = 0;

      while (i < tied.length && spotsRemaining > 0) {
        const current = tied[i];
        let j = i;
        while (j < tied.length && tied[j]._score === current._score) j++;
        const sameCount = j - i;

        if (sameCount <= spotsRemaining) {
          for (let k = i; k < j; k++) {
            const p = tied[k];
            if (p._score < 0) {
              p._reason =
                "Position saturee (" +
                (POS_FULL_LABELS[p.position_1] || "?") +
                ").";
            } else {
              let r =
                "Egalite de presences (" +
                p.pres3 +
                "/" +
                maxT3 +
                ", " +
                p.pres5 +
                "/" +
                maxT5 +
                ") → departage par composition";
              if (evaluations)
                r +=
                  p._evaluationAverage !== undefined
                    ? " puis moyenne (" +
                      p._evaluationAverage.toLocaleString("fr-FR", {
                        maximumFractionDigits: 1,
                      }) +
                      "/10)"
                    : " (évaluations incomplètes : départage par notes indisponible)";
              else if ((p.level || 2) !== 2)
                r += " et niveau (" + p.level + ")";
              r += ".";
              p._reason = r;
            }
            countPlayer(p);
            const grp = p.position_1 && POS_GROUPS[p.position_1];
            if (grp && remainingNeeds[grp] > 0) remainingNeeds[grp]--;
            selected.push(p);
          }
          spotsRemaining -= sameCount;
        } else {
          const groupNames = [];
          for (let k = i; k < j; k++) groupNames.push(tied[k].name);
          for (let k = i; k < j; k++) {
            const p = tied[k];
            const others = groupNames.filter((n) => n !== p.name);
            let r =
              "Egalite de presences (" +
              p.pres3 +
              "/" +
              maxT3 +
              ", " +
              p.pres5 +
              "/" +
              maxT5 +
              ")";
            r += evaluations
              ? ", même priorité de composition et moyennes égales ou incomplètes"
              : ", meme score de composition et niveau (" +
                (p.level || 2) +
                ")";
            r += ". En competition avec " + others.join(", ");
            r +=
              " pour " +
              spotsRemaining +
              " place" +
              (spotsRemaining > 1 ? "s" : "") +
              ".";
            p._reason = r;
            deliberation.push(p);
          }
          if (evaluations) spotsRemaining = 0;
        }
        i = j;
      }

      while (i < tied.length) {
        const p = tied[i];
        if (p._exceed === "pos") {
          p._reason =
            "Position saturee : deja " +
            POS_MAXIMUMS[p.position_1] +
            " " +
            (POS_FULL_LABELS[p.position_1] || "?") +
            " selectionnee(s).";
        } else if (p._exceed === "group") {
          const grp = POS_GROUPS[p.position_1];
          p._reason =
            "Groupe sature : deja " +
            GROUP_MAXIMUMS[grp] +
            " " +
            (GROUP_LABELS[grp] || grp) +
            " selectionnee(s).";
        } else {
          p._reason = "Plus de place disponible (score insuffisant).";
        }
        excluded.push(p);
        i++;
      }

      below.forEach((p) => {
        p._reason =
          "Presences insuffisantes (" +
          p.pres3 +
          "/" +
          maxT3 +
          ", " +
          p.pres5 +
          "/" +
          maxT5 +
          ") par rapport au seuil (" +
          cutPres3 +
          "/" +
          maxT3 +
          ", " +
          cutPres5 +
          "/" +
          maxT5 +
          ").";
      });
      excluded.push(...below);
    }
  }

  return { selected, deliberation, excluded, maxT3, maxT5 };
}
export function scorePlayers(players, trainings) {
  const sorted = [...trainings].sort((a, b) => a.date.localeCompare(b.date));
  return players.map((p) => ({
    ...p,
    pres3: sorted
      .slice(-3)
      .filter((t) => t.presentIds.map(String).includes(String(p.id))).length,
    pres5: sorted
      .slice(-5)
      .filter((t) => t.presentIds.map(String).includes(String(p.id))).length,
  }));
}

export const DEFAULT_FORMATION = {
  field: { gardienne: 1, defense: 4, milieu: 3, attaque: 3 },
  bench: { gardienne: 0, defense: 2, milieu: 2, attaque: 1 },
};
export function formationTotal(formation, zone) {
  return Object.values(formation[zone] || {}).reduce(
    (sum, count) => sum + Number(count),
    0,
  );
}
export function validateFormation(formation) {
  for (const [zone, limit] of [
    ["field", 11],
    ["bench", 5],
  ]) {
    for (const [pos, count] of Object.entries(formation[zone] || {})) {
      if (!(pos in GROUP_LABELS) || !Number.isInteger(count) || count < 0)
        return "Renseigne un nombre entier positif ou nul pour chaque poste.";
    }
    if (formationTotal(formation, zone) > limit)
      return zone === "field"
        ? "Maximum 11 joueuses sur le terrain."
        : "Maximum 5 joueuses sur le banc.";
  }
  if (formation.field?.gardienne !== 1)
    return "Prévois une gardienne sur le terrain.";
  return "";
}
const positionsOf = (p) =>
  [p._originalPos || p.position_1, p.position_2, p.position_3].map(
    (pos) => POS_GROUPS[pos] || pos,
  );
const preciseRolesOf = (player, group) =>
  [
    ...new Set([
      player._originalPos || player.position_1,
      player.position_2,
      player.position_3,
    ]),
  ].filter((role) => POS_GROUPS[role] === group);

// Composition is a tie-breaker after attendance and preferred position group.
// Prefer an underrepresented specialty; scarce specialists go first when
// several seats remain. Do not invent a specialty for an out-of-position move.
function roleChoices(players, selected, zone, group, seats) {
  const roles = [...new Set(players.flatMap((p) => preciseRolesOf(p, group)))];
  const count = (role) =>
    selected.filter((p) => p._zone === zone && p._role === role).length;
  const availability = (role) =>
    players.filter((p) => preciseRolesOf(p, group).includes(role)).length;
  const compare = (a, b) =>
    count(a) - count(b) || (seats > 1 ? availability(a) - availability(b) : 0);
  roles.sort(compare);
  return roles.filter((role) => compare(role, roles[0]) === 0);
}

export function matchVacancies(result) {
  return ["field", "bench"].flatMap((zone) =>
    Object.entries(result.formation[zone] || {}).flatMap(
      ([position, quota]) => {
        const count =
          quota -
          result.selected.filter(
            (p) => p._zone === zone && p._fieldPos === position,
          ).length;
        return count > 0 ? [{ zone, position, count }] : [];
      },
    ),
  );
}
export function canAssignPlayer(result, id, zone, position) {
  if (zone === "excluded") return true;
  if (!["field", "bench"].includes(zone)) return false;
  const others = result.selected.filter((p) => String(p.id) !== String(id));
  return (
    others.filter((p) => p._zone === zone).length <
      (zone === "field" ? 11 : 5) &&
    others.filter((p) => p._zone === zone && p._fieldPos === position).length <
      (result.formation[zone]?.[position] || 0)
  );
}
export function moveMatchPlayer(result, id, zone, position) {
  const player = [
    ...result.selected,
    ...result.deliberation,
    ...result.excluded,
  ].find((p) => String(p.id) === String(id));
  if (!player) throw new Error("Joueuse introuvable.");
  if (!canAssignPlayer(result, id, zone, position))
    throw new Error(
      "Ce poste est complet. Libère une place ou modifie la répartition.",
    );
  const next = { ...result };
  for (const key of ["selected", "deliberation", "excluded"])
    next[key] = result[key].filter((p) => String(p.id) !== String(id));
  const moved = {
    ...player,
    _zone: zone,
    _fieldPos: position,
    _role: preciseRolesOf(player, position)[0] || null,
    _reason: "Affectation ajustée manuellement.",
  };
  next[zone === "excluded" ? "excluded" : "selected"].push(moved);
  next.vacancies = matchVacancies(next);
  return next;
}

function selectFormation(input, trainings, goalieId, evaluations, formation) {
  const error = validateFormation(formation);
  if (error) throw new Error(error);
  const chosen = input.find((p) => String(p.id) === String(goalieId));
  if (!chosen)
    throw new Error("Choisis une gardienne parmi les joueuses disponibles.");
  const selected = [
    {
      ...chosen,
      _fieldPos: "gardienne",
      _role: "gardienne",
      _zone: "field",
      _reason: "Gardienne choisie pour cette rencontre.",
    },
  ];
  const assigned = new Set([String(chosen.id)]);
  const undecided = new Map();
  const remaining = Object.keys(GROUP_LABELS).filter(
    (pos) =>
      (formation.field[pos] || 0) +
        (formation.bench[pos] || 0) -
        (pos === "gardienne" ? 1 : 0) >
      0,
  );
  const candidatesFor = (pos) =>
    input.filter(
      (p) => !assigned.has(String(p.id)) && positionsOf(p).includes(pos),
    );
  while (remaining.length) {
    // Fill the positions with the fewest compatible candidates first, so a
    // versatile player can cover a scarce position instead of blocking a specialist.
    remaining.sort((a, b) => candidatesFor(a).length - candidatesFor(b).length);
    const pos = remaining.shift();
    const fieldCount =
      (formation.field[pos] || 0) - (pos === "gardienne" ? 1 : 0);
    const capacity = fieldCount + (formation.bench[pos] || 0);
    const candidates = candidatesFor(pos);
    const baseCompare = (a, b) =>
      b.pres3 - a.pres3 ||
      b.pres5 - a.pres5 ||
      positionsOf(a).indexOf(pos) - positionsOf(b).indexOf(pos);
    candidates.sort(baseCompare);
    let used = 0;
    for (let i = 0; i < candidates.length && used < capacity;) {
      let j = i + 1;
      while (
        j < candidates.length &&
        baseCompare(candidates[i], candidates[j]) === 0
      )
        j++;
      const tied = candidates.slice(i, j);
      const averages = evaluations
        ? tied.map((p) => evaluationSummary(evaluations[p.id] || {}).average)
        : [];
      const ranked = tied
        .map((p, index) => ({
          p,
          merit: evaluations
            ? averages.every((v) => v !== null)
              ? averages[index]
              : 0
            : 3 - (p.level || 2),
        }))
        .sort((a, b) => b.merit - a.merit);
      const pool = [...ranked];
      while (pool.length && used < capacity) {
        const zone = used < fieldCount ? "field" : "bench";
        const seats = capacity - used;
        const preferredRoles = roleChoices(
          pool.map((entry) => entry.p),
          selected,
          zone,
          pos,
          seats,
        );
        const compatible = pool.filter(
          ({ p }) =>
            !preferredRoles.length ||
            preciseRolesOf(p, pos).some((role) =>
              preferredRoles.includes(role),
            ),
        );
        const bestMerit = Math.max(...compatible.map((entry) => entry.merit));
        const group = compatible
          .filter((entry) => entry.merit === bestMerit)
          .map((entry) => entry.p);
        if (group.length > seats) {
          for (const p of group)
            undecided.set(String(p.id), {
              ...p,
              _reason: `Égalité pour ${seats} place(s) au poste ${GROUP_LABELS[pos]}, après prise en compte des rôles précis. Choix manuel nécessaire.`,
            });
          used = capacity;
        } else {
          const p = group[0];
          const role =
            preciseRolesOf(p, pos).find((role) =>
              preferredRoles.includes(role),
            ) ||
            preciseRolesOf(p, pos)[0] ||
            null;
          selected.push({
            ...p,
            _fieldPos: pos,
            _role: role,
            _zone: zone,
            _reason: `Poste compatible · ${p.pres3}/${Math.min(3, trainings.length)} puis ${p.pres5}/${Math.min(5, trainings.length)} présences. À égalité : préférence de poste, équilibre des rôles précis, puis ${evaluations ? "évaluation complète" : "niveau"}.`,
          });
          assigned.add(String(p.id));
          pool.splice(
            pool.findIndex((entry) => String(entry.p.id) === String(p.id)),
            1,
          );
          used++;
        }
      }
      i = j;
    }
  }
  const result = {
    selected,
    deliberation: [...undecided.values()].filter(
      (p) => !assigned.has(String(p.id)),
    ),
    excluded: input
      .filter(
        (p) => !assigned.has(String(p.id)) && !undecided.has(String(p.id)),
      )
      .map((p) => ({
        ...p,
        _reason: "Places compatibles attribuées ou réservées à un départage.",
      })),
    maxT3: Math.min(3, trainings.length),
    maxT5: Math.min(5, trainings.length),
    formation: structuredClone(formation),
  };
  result.vacancies = matchVacancies(result);
  return result;
}

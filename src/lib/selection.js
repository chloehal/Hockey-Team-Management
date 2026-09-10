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
  defense: "Defense",
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

export function selectMatch(input, trainings, chosenGoalieId) {
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
        const levelScore = 3 - (p.level || 2);
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
              if ((p.level || 2) !== 2) r += " et niveau (" + p.level + ")";
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
            r +=
              ", meme score de composition et niveau (" + (p.level || 2) + ")";
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

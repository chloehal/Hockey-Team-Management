import { useState } from "react";
import {
  Heading,
  Section,
  Button,
  Checklist,
  Empty,
} from "../components/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import {
  scorePlayers,
  selectMatch,
  POS_GROUPS,
  POS_FULL_LABELS,
  GROUP_LABELS,
} from "../lib/selection";
import { exportMatch } from "../lib/export-match";
export default function Match({
  team,
  coach = false,
  evaluations,
  draft,
  setDraft,
}) {
  const { data, offline } = team;
  const { available, result } = draft;
  const setAvailable = (available) =>
    setDraft((old) => ({ ...old, available }));
  const setResult = (update) =>
    setDraft((old) => ({
      ...old,
      result: typeof update === "function" ? update(old.result) : update,
    }));
  const [pending, setPending] = useState(null),
    [exportError, setExportError] = useState("");
  function finish(scored, goalie) {
    setResult(selectMatch(scored, data.trainings, goalie, evaluations));
    setPending(null);
  }
  function generate() {
    const scored = scorePlayers(
      data.players.filter((p) => available.includes(String(p.id))),
      data.trainings,
    );
    const keepers = scored.filter((p) => p.position_1 === "gardienne");
    if (keepers.length === 1) finish(scored, keepers[0].id);
    else
      setPending({
        scored,
        options: keepers.length ? keepers : scored,
        replacement: !keepers.length,
      });
  }
  function move(id, group) {
    setResult((old) => {
      let p = [...old.selected, ...old.deliberation, ...old.excluded].find(
        (p) => String(p.id) === String(id),
      );
      if (!p) return old;
      const selected = old.selected.filter((p) => String(p.id) !== String(id)),
        deliberation = old.deliberation.filter(
          (p) => String(p.id) !== String(id),
        ),
        excluded = old.excluded.filter((p) => String(p.id) !== String(id));
      if (group === "bench") excluded.push(p);
      else {
        if (selected.length >= 16) return old;
        const defaultPos = {
          gardienne: "gardienne",
          defense: "defense_centrale",
          milieu: "milieu_centre",
          attaque: "attaquante_centre",
        };
        const pos =
          [p._originalPos || p.position_1, p.position_2, p.position_3].find(
            (pos) => POS_GROUPS[pos] === group,
          ) || defaultPos[group];
        selected.push({ ...p, _fieldPos: pos });
      }
      return { ...old, selected, deliberation, excluded };
    });
  }
  return (
    <>
      <Heading
        title={coach ? "Préparer la sélection." : "La feuille de match."}
        description={
          coach
            ? "Présences, postes, puis moyenne sur 10 à priorité égale. Les sept notes doivent être remplies pour toutes les joueuses à départager."
            : "Disponibilités, présences, composition : jusqu’à 16 joueuses."
        }
      />
      <Section
        title="Qui est disponible ?"
        description="Les choix de cette feuille ne modifient pas les fiches des joueuses."
      >
        <Checklist
          players={data.players}
          selected={available}
          setSelected={setAvailable}
        />
        <Button
          className="mt-5"
          disabled={!available.length || offline || (coach && !evaluations)}
          onClick={generate}
        >
          Générer la sélection
        </Button>
      </Section>
      <Dialog
        open={Boolean(pending)}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.replacement
                ? "Qui remplace la gardienne ?"
                : "Choisir la gardienne"}
            </DialogTitle>
            <DialogDescription>
              Une seule gardienne est retenue pour cette feuille.
            </DialogDescription>
          </DialogHeader>
          <div className="stack">
            {pending?.options.map((p) => (
              <Button
                variant="outline"
                key={p.id}
                onClick={() => finish(pending.scored, p.id)}
              >
                {p.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {result && (
        <div className="match-result">
          <Section
            title={`La sélection · ${result.selected.length}/16`}
            description={
              result.deliberation.length
                ? `${result.deliberation.length} joueuses à départager. Le choix final reste manuel.`
                : "La feuille est prête à être ajustée."
            }
          >
            <div className="pitch">
              {["attaque", "milieu", "defense", "gardienne"].map((group) => (
                <div
                  className="pitch-line"
                  key={group}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    move(e.dataTransfer.getData("text/plain"), group);
                  }}
                >
                  <span className="pitch-label">{GROUP_LABELS[group]}</span>
                  <div className="pitch-players">
                    {result.selected
                      .filter(
                        (p) =>
                          (POS_GROUPS[p._fieldPos || p.position_1] ||
                            "attaque") === group,
                      )
                      .map((p) => (
                        <div
                          className="pitch-player"
                          key={p.id}
                          draggable
                          onDragStart={(e) =>
                            e.dataTransfer.setData("text/plain", String(p.id))
                          }
                        >
                          <span className="shirt">{p.number || "—"}</span>
                          <strong>{p.name}</strong>
                          <select
                            aria-label={`Position de ${p.name}`}
                            value={
                              p._fieldPos || p.position_1 || "attaquante_centre"
                            }
                            onChange={(e) => {
                              const pos = e.target.value;
                              setResult((old) => ({
                                ...old,
                                selected: old.selected.map((q) =>
                                  q.id === p.id ? { ...q, _fieldPos: pos } : q,
                                ),
                              }));
                            }}
                          >
                            {Object.entries(POS_FULL_LABELS).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                          {![
                            p._originalPos || p.position_1,
                            p.position_2,
                            p.position_3,
                          ].includes(p._fieldPos || p.position_1) && (
                            <small>Hors poste habituel</small>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => move(p.id, "bench")}
                          >
                            Au banc
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="toolbar no-print">
              <Button variant="outline" onClick={() => window.print()}>
                Imprimer
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await exportMatch(result);
                    setExportError("");
                  } catch {
                    setExportError(
                      "Impossible de générer le PNG. Tu peux utiliser l’impression.",
                    );
                  }
                }}
              >
                Exporter PNG
              </Button>
            </div>
            {exportError && <p role="alert">{exportError}</p>}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Joueuse</th>
                    <th>Poste</th>
                    <th>3 dernières</th>
                    <th>5 dernières</th>
                    {coach && <th>Explication</th>}
                  </tr>
                </thead>
                <tbody>
                  {result.selected.map((p) => (
                    <tr key={p.id}>
                      <th>{p.name}</th>
                      <td>
                        {POS_FULL_LABELS[p._fieldPos || p.position_1] || "—"}
                      </td>
                      <td>
                        {p.pres3}/{result.maxT3}
                      </td>
                      <td>
                        {p.pres5}/{result.maxT5}
                      </td>
                      {coach && <td>{p._reason}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          {["deliberation", "excluded"].map((key) => (
            <Section
              key={key}
              title={
                key === "deliberation" ? "À départager" : "Banc / non retenues"
              }
            >
              {!result[key].length ? (
                <Empty />
              ) : (
                result[key].map((p) => (
                  <div className="list-row" key={p.id}>
                    <div>
                      <strong>{p.name}</strong>
                      <p className="muted">
                        {p.pres3}/{result.maxT3} puis {p.pres5}/{result.maxT5}
                      </p>
                      {coach && <p className="muted">{p._reason}</p>}
                    </div>
                    <Button
                      disabled={result.selected.length >= 16}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        move(
                          p.id,
                          POS_GROUPS[p._originalPos || p.position_1] ||
                            "attaque",
                        )
                      }
                    >
                      Sélectionner
                    </Button>
                  </div>
                ))
              )}
            </Section>
          ))}
        </div>
      )}
    </>
  );
}

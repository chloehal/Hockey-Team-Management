import { useEffect, useRef, useState } from "react";
import { TriangleAlert, ArrowDown } from "lucide-react";
import {
  Heading,
  Section,
  Button,
  Checklist,
  Empty,
  Input,
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
  GROUP_LABELS,
  POS_FULL_LABELS,
  DEFAULT_FORMATION,
  formationTotal,
  validateFormation,
  canAssignPlayer,
  moveMatchPlayer,
} from "../lib/selection";
import { exportMatch } from "../lib/export-match";
const ZONES = { field: "Terrain", bench: "Banc" };

export default function Match({
  team,
  coach = false,
  evaluations,
  draft,
  setDraft,
}) {
  const { data, offline, presenceReady } = team;
  const { available, result } = draft;
  const missingPlaces =
    result?.vacancies.reduce((total, v) => total + v.count, 0) || 0;
  const selectionStatus = result
    ? `${result.deliberation.length} ${result.deliberation.length > 1 ? "joueuses à départager" : "joueuse à départager"} · ${missingPlaces} ${missingPlaces > 1 ? "places à combler" : "place à combler"}`
    : "";
  const formation = draft.formation || DEFAULT_FORMATION;
  const [configuring, setConfiguring] = useState(false);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");
  const [generation, setGeneration] = useState(0);
  const warningRef = useRef(null);
  const deliberationRef = useRef(null);
  useEffect(() => {
    if (!generation) return;
    const frame = requestAnimationFrame(() => {
      warningRef.current?.focus({ preventScroll: true });
      warningRef.current?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [generation]);
  const invalid = validateFormation(formation);
  function configure() {
    setError("");
    setConfiguring(true);
  }
  function setQuota(zone, pos, raw) {
    const value = raw === "" ? "" : Number(raw);
    setDraft((old) => ({
      ...old,
      formation: {
        ...(old.formation || DEFAULT_FORMATION),
        [zone]: { ...(old.formation || DEFAULT_FORMATION)[zone], [pos]: value },
      },
    }));
  }
  function finish(goalie) {
    try {
      const scored = scorePlayers(
        data.players.filter((p) => available.includes(String(p.id))),
        data.trainings,
      );
      const next = selectMatch(
        scored,
        data.trainings,
        goalie,
        evaluations,
        formation,
      );
      setDraft((old) => ({ ...old, result: next }));
      setGeneration((value) => value + 1);
      setPending(null);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function generate(e) {
    e.preventDefault();
    if (invalid) return;
    setConfiguring(false);
    const players = data.players.filter((p) =>
      available.includes(String(p.id)),
    );
    const keepers = players.filter((p) => p.position_1 === "gardienne");
    if (keepers.length === 1) finish(keepers[0].id);
    else
      setPending({
        options: keepers.length ? keepers : players,
        replacement: !keepers.length,
      });
  }
  function move(id, zone, pos) {
    try {
      const next = moveMatchPlayer(result, id, zone, pos);
      setDraft((old) => ({ ...old, result: next }));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  function drop(e, zone, group) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const player = [
      ...result.selected,
      ...result.deliberation,
      ...result.excluded,
    ].find((p) => String(p.id) === id);
    if (!player) return;
    const positions = [
      ...new Set([
        player._fieldPos,
        POS_GROUPS[player.position_1],
        POS_GROUPS[player.position_2],
        POS_GROUPS[player.position_3],
        ...Object.keys(GROUP_LABELS),
      ]),
    ];
    const pos = positions.find(
      (pos) =>
        (!group || pos === group) && canAssignPlayer(result, id, zone, pos),
    );
    if (pos) move(id, zone, pos);
    else
      setError(
        "Aucune place libre ici. Libère une place ou modifie la répartition.",
      );
  }
  function assignment(player) {
    const selected = result.selected.some(
      (p) => String(p.id) === String(player.id),
    );
    return (
      <select
        className="control no-print"
        aria-label={`Affectation de ${player.name}`}
        value={selected ? `${player._zone}:${player._fieldPos}` : ""}
        onChange={(e) => {
          const [zone, pos] = e.target.value.split(":");
          move(player.id, zone, pos);
        }}
      >
        {!selected && (
          <option value="" disabled>
            Affecter à une place…
          </option>
        )}
        {Object.entries(ZONES).map(([zone, label]) => (
          <optgroup key={zone} label={label}>
            {Object.entries(GROUP_LABELS)
              .filter(([pos]) => result.formation[zone][pos] > 0)
              .map(([pos, name]) => (
                <option
                  key={pos}
                  value={`${zone}:${pos}`}
                  disabled={!canAssignPlayer(result, player.id, zone, pos)}
                >
                  {label} · {name}
                </option>
              ))}
          </optgroup>
        ))}
        <option value="excluded">Non retenue</option>
      </select>
    );
  }
  function card(p) {
    return (
      <div
        className="pitch-player"
        key={p.id}
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/plain", String(p.id))}
      >
        <span className="shirt">{p.number || "—"}</span>
        <strong>{p.name}</strong>
        <small>{POS_FULL_LABELS[p._role] || GROUP_LABELS[p._fieldPos]}</small>
        {assignment(p)}
        {![p.position_1, p.position_2, p.position_3]
          .map((pos) => POS_GROUPS[pos] || pos)
          .includes(p._fieldPos) && <small>Hors poste habituel</small>}
      </div>
    );
  }
  function candidateSection(key) {
    return (
      <section
        key={key}
        className="match-candidate-section"
        ref={key === "deliberation" ? deliberationRef : undefined}
        tabIndex={key === "deliberation" ? -1 : undefined}
        aria-label={
          key === "deliberation"
            ? "Joueuses à départager"
            : "Joueuses non retenues"
        }
      >
        <Section
          title={
            key === "deliberation"
              ? `À départager · ${result.deliberation.length}`
              : "Non retenues"
          }
          description={
            key === "deliberation"
              ? "Pour chaque joueuse, choisis une place sur le terrain ou le banc, ou indique « Non retenue ». Le compteur se met à jour à chaque décision."
              : undefined
          }
        >
          {key === "deliberation" && (
            <div className="match-vacancies" role="status">
              <strong>{selectionStatus}</strong>
              {missingPlaces > 0 ? (
                <ul>
                  {result.vacancies.map((v) => (
                    <li key={`${v.zone}:${v.position}`}>
                      {ZONES[v.zone]} · {GROUP_LABELS[v.position]} : {v.count}{" "}
                      {v.count > 1 ? "places à combler" : "place à combler"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  Toutes les places demandées sont pourvues. Indique « Non
                  retenue » pour les joueuses restantes, ou libère une place
                  pour changer ton choix.
                </p>
              )}
            </div>
          )}
          {!result[key].length ? (
            <Empty />
          ) : (
            result[key].map((p) => (
              <div className="list-row match-candidate" key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  <p className="muted">
                    {p.pres3}/{result.maxT3} puis {p.pres5}/{result.maxT5}
                  </p>
                  {(coach || key === "deliberation") && (
                    <p className="muted">{p._reason}</p>
                  )}
                </div>
                {assignment(p)}
              </div>
            ))
          )}
        </Section>
      </section>
    );
  }
  const field = result?.selected.filter((p) => p._zone === "field") || [];
  const bench = result?.selected.filter((p) => p._zone === "bench") || [];
  return (
    <>
      <Heading
        title={coach ? "Préparer la sélection." : "La feuille de match."}
        description="Choisis les disponibles, puis le nombre de joueuses par poste : jusqu’à 11 sur le terrain et 5 sur le banc."
      />
      <Section
        title="Qui est disponible ?"
        description="La répartition par poste se règle à l’étape suivante, avant le calcul de la sélection."
      >
        <Checklist
          players={data.players}
          selected={available}
          setSelected={(available) =>
            setDraft((old) => ({ ...old, available, result: null }))
          }
        />
        <Button
          className="mt-5"
          disabled={
            !available.length ||
            !presenceReady ||
            offline ||
            (coach && !evaluations)
          }
          onClick={configure}
        >
          Générer la sélection
        </Button>
      </Section>
      <Dialog open={configuring} onOpenChange={setConfiguring}>
        <DialogContent className="formation-dialog">
          <DialogHeader>
            <DialogTitle>Répartition de la feuille</DialogTitle>
            <DialogDescription>
              Indique combien de joueuses tu veux à chaque poste, sur le terrain
              et sur le banc. La gardienne compte dans les 11.
            </DialogDescription>
          </DialogHeader>
          <form className="stack" onSubmit={generate}>
            <div className="formation-totals" aria-live="polite">
              <strong data-invalid={formationTotal(formation, "field") > 11}>
                Terrain : {formationTotal(formation, "field")}/11
              </strong>
              <strong data-invalid={formationTotal(formation, "bench") > 5}>
                Banc : {formationTotal(formation, "bench")}/5
              </strong>
            </div>
            <div className="formation-grid">
              <span>Poste</span>
              <strong>Terrain</strong>
              <strong>Banc</strong>
              {Object.entries(GROUP_LABELS).map(([pos, label]) => (
                <div className="formation-row" key={pos}>
                  <span>{label}</span>
                  {Object.entries(ZONES).map(([zone, name]) => (
                    <Input
                      key={zone}
                      type="number"
                      inputMode="numeric"
                      min={zone === "field" && pos === "gardienne" ? 1 : 0}
                      max={
                        zone === "field" ? (pos === "gardienne" ? 1 : 11) : 5
                      }
                      step="1"
                      required
                      aria-label={`${name} · ${label}`}
                      value={formation[zone][pos] ?? 0}
                      onChange={(e) => setQuota(zone, pos, e.target.value)}
                    />
                  ))}
                </div>
              ))}
            </div>
            <p className="muted">
              Les présences sur 3 puis 5 entraînements restent prioritaires
              entre candidates à un même poste. Les places sans joueuse
              compatible et les égalités seront signalées.
            </p>
            {invalid && (
              <p role="alert" className="error">
                {invalid}
              </p>
            )}
            <div className="toolbar">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfiguring(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={
                  Boolean(invalid) ||
                  offline ||
                  !available.length ||
                  (coach && !evaluations)
                }
              >
                Valider la répartition
              </Button>
            </div>
            {result && (
              <p className="muted">
                Valider génère une nouvelle feuille et remplace les ajustements
                manuels.
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(pending)}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent className="formation-dialog">
          <DialogHeader>
            <DialogTitle>
              {pending?.replacement
                ? "Qui remplace la gardienne ?"
                : "Choisir la gardienne"}
            </DialogTitle>
            <DialogDescription>
              Choisis la gardienne titulaire pour générer la feuille avec cette
              répartition.
            </DialogDescription>
          </DialogHeader>
          <div className="stack">
            {pending?.options.map((p) => (
              <Button variant="outline" key={p.id} onClick={() => finish(p.id)}>
                {p.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result && (
        <div className="match-result">
          {result.deliberation.length > 0 && (
            <div
              className="deliberation-warning"
              role="alert"
              ref={warningRef}
              tabIndex={-1}
            >
              <TriangleAlert size={26} aria-hidden="true" />
              <div className="deliberation-warning-content">
                <h2>Sélection à compléter</h2>
                <p className="deliberation-count">{selectionStatus}</p>
                <p>
                  Des égalités restent à résoudre. Choisis les joueuses à
                  retenir avant de partager la feuille.
                </p>
                <p className="deliberation-names">
                  {result.deliberation.map((p) => p.name).join(" · ")}
                </p>
                <Button
                  type="button"
                  className="no-print"
                  onClick={() => {
                    deliberationRef.current?.focus({ preventScroll: true });
                    deliberationRef.current?.scrollIntoView({ block: "start" });
                  }}
                >
                  <ArrowDown size={16} aria-hidden="true" />
                  Départager les joueuses
                </Button>
              </div>
            </div>
          )}
          <Section
            title={`La sélection · ${result.selected.length}/16`}
            description={
              result.deliberation.length
                ? `${result.deliberation.length} joueuses à départager. Affecte-les aux places libres.`
                : "Ajuste les affectations dans la limite des places demandées."
            }
            action={
              <Button
                className="no-print"
                variant="outline"
                disabled={offline || (coach && !evaluations)}
                onClick={configure}
              >
                Modifier la répartition
              </Button>
            }
          >
            <div className="formation-totals">
              <strong>Terrain : {field.length}/11</strong>
              <strong>Banc : {bench.length}/5</strong>
            </div>
            {result.vacancies.length > 0 && (
              <div className="match-vacancies" role="status">
                <strong>Places à compléter</strong>
                <p>
                  {result.vacancies
                    .map(
                      (v) =>
                        `${ZONES[v.zone]} · ${GROUP_LABELS[v.position]} : ${v.count}`,
                    )
                    .join(" / ")}
                </p>
              </div>
            )}
            <h3 className="lineup-heading">
              Titulaires · {field.length}/
              {formationTotal(result.formation, "field")} demandées
            </h3>
            <div className="pitch">
              {["attaque", "milieu", "defense", "gardienne"].map((group) => (
                <div
                  className="pitch-line"
                  key={group}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => drop(e, "field", group)}
                >
                  <span className="pitch-label">{GROUP_LABELS[group]}</span>
                  <div className="pitch-players">
                    {field.filter((p) => p._fieldPos === group).map(card)}
                  </div>
                </div>
              ))}
            </div>
            <div
              className="match-bench"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => drop(e, "bench")}
            >
              <h3 className="lineup-heading">
                Remplaçantes · {bench.length}/
                {formationTotal(result.formation, "bench")} demandées
              </h3>
              {bench.length ? (
                <div className="pitch-players">{bench.map(card)}</div>
              ) : (
                <Empty>Aucune remplaçante affectée.</Empty>
              )}
            </div>
            {result.deliberation.length > 0 && candidateSection("deliberation")}
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
                    <th>Affectation</th>
                    <th>Poste</th>
                    <th>3 dernières</th>
                    <th>5 dernières</th>
                    {coach && <th>Explication</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...field, ...bench].map((p) => (
                    <tr key={p.id}>
                      <th>{p.name}</th>
                      <td>{ZONES[p._zone]}</td>
                      <td>
                        {POS_FULL_LABELS[p._role] || GROUP_LABELS[p._fieldPos]}
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
          {candidateSection("excluded")}
        </div>
      )}
    </>
  );
}

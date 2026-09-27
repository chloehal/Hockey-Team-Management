import { useState } from "react";
import {
  Card,
  Heading,
  Section,
  Field,
  Choice,
  SaveForm,
  Confirm,
  Button,
  dateLabel,
  Checklist,
} from "../components/shared";
import { ChevronDown } from "lucide-react";
import { evaluationSummary } from "../lib/evaluations";
import { request } from "../lib/api";
import { POS_FULL_LABELS } from "../lib/selection";
import Match from "./Match";
import PlayerEvaluation from "../components/PlayerEvaluation";
function PlayerEditor({
  player,
  team,
  evaluation,
  saveEvaluation,
  evaluationsReady,
  password,
}) {
  const [positions, setPositions] = useState([
    player.position_1 || "",
    player.position_2 || "",
    player.position_3 || "",
  ]);
  const { average } = evaluationSummary(evaluation || {});
  return (
    <Card className="player-collapse">
      <details>
        <summary>
          <strong>{`${player.number ? `#${player.number} · ` : ""}${player.name}`}</strong>
          <span className="player-collapse-average">
            {!evaluationsReady
              ? "…"
              : average === null
                ? "Non évaluée"
                : `${average.toLocaleString("fr-BE", { maximumFractionDigits: 1 })} /10`}
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className="player-collapse-content">
          <SaveForm
            disabled={team.busy || team.offline}
            onSave={() =>
              team.mutate("update_player_details", {
                id: player.id,
                position_1: positions[0] || null,
                position_2: positions[1] || null,
                position_3: positions[2] || null,
                level: Number(player.level || 2),
              })
            }
          >
            <div className="form-grid">
              {positions.map((pos, i) => (
                <Choice
                  key={i}
                  label={`Poste ${i + 1}`}
                  value={pos}
                  onChange={(v) =>
                    setPositions((old) => old.map((p, j) => (j === i ? v : p)))
                  }
                  options={[
                    ["", "Non renseigné"],
                    ...Object.entries(POS_FULL_LABELS),
                  ]}
                />
              ))}
            </div>
          </SaveForm>
          {evaluationsReady && (
            <PlayerEvaluation
              initial={evaluation}
              disabled={team.busy || team.offline}
              save={saveEvaluation}
            />
          )}
          <Confirm
            title={`Supprimer ${player.name} ?`}
            disabled={team.busy || team.offline}
            onConfirm={() =>
              team.mutate("delete_player", { id: player.id, password })
            }
          />
        </div>
      </details>
    </Card>
  );
}
function TrainingEditor({ training, team, password }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState([]);
  return (
    <Card>
      <div className="list-row">
        <div>
          <strong>{dateLabel(training.date)}</strong>
          <p className="muted">{training.presentIds.length} présentes</p>
        </div>
        <Button
          variant="outline"
          disabled={team.busy || team.offline}
          onClick={() => {
            setSelected(training.presentIds.map(String));
            setEditing(!editing);
          }}
        >
          {editing ? "Annuler" : "Modifier les présences"}
        </Button>
        <Confirm
          title="Supprimer cette séance et ses présences ?"
          disabled={team.busy || team.offline}
          onConfirm={() =>
            team.mutate("delete_training", { id: training.id, password })
          }
        />
      </div>
      {editing && (
        <SaveForm
          label="Enregistrer les présences"
          disabled={team.busy || team.offline}
          onSave={async () => {
            await team.mutate("save_training", {
              date: training.date,
              presentIds: selected,
              password,
            });
            setEditing(false);
          }}
        >
          <Checklist
            players={team.data.players}
            selected={selected}
            setSelected={setSelected}
          />
        </SaveForm>
      )}
    </Card>
  );
}
export default function Coach({ team, draft, setDraft }) {
  const [unlocked, setUnlocked] = useState(false),
    [tab, setTab] = useState("players"),
    [formKey, setFormKey] = useState(0),
    [password, setPassword] = useState(""),
    [evaluations, setEvaluations] = useState(null),
    [evaluationError, setEvaluationError] = useState("");
  async function loadEvaluations(credential) {
    setEvaluationError("");
    try {
      setEvaluations(
        await request("get_player_evaluations", { password: credential }),
      );
    } catch (error) {
      setEvaluationError(error.message);
    }
  }
  function lock() {
    setUnlocked(false);
    setPassword("");
    setEvaluations(null);
    setEvaluationError("");
    setDraft((old) => ({ ...old, result: null }));
  }

  if (!unlocked)
    return (
      <>
        <Heading
          title="Espace coach."
          description="Retrouve les postes, les évaluations et les outils de sélection."
        />
        <Section title="Accès coach">
          <SaveForm
            label="Ouvrir l’espace coach"
            onSave={async (f) => {
              const result = await request("verify_coach_password", {
                password: f.get("password"),
              });
              if (!result.ok) throw new Error("Mot de passe incorrect.");
              const credential = String(f.get("password"));
              setPassword(credential);
              setUnlocked(true);
              await loadEvaluations(credential);
            }}
          >
            <Field
              label="Mot de passe coach"
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </SaveForm>
        </Section>
      </>
    );
  return (
    <>
      <Heading
        title="Côté coach."
        description="Gérer l’effectif et préparer les rencontres."
      >
        <Button variant="outline" onClick={lock}>
          Verrouiller
        </Button>
      </Heading>
      {evaluationError && (
        <div className="error" role="alert">
          {evaluationError}
          <Button variant="outline" onClick={() => loadEvaluations(password)}>
            Recharger les évaluations
          </Button>
        </div>
      )}
      <div className="toolbar">
        {[
          ["players", "Joueuses"],
          ["match", "Sélection"],
          ["trainings", "Séances"],
          ["settings", "Accès"],
        ].map(([key, label]) => (
          <Button
            key={key}
            variant={tab === key ? "default" : "outline"}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === "match" ? (
        <Match
          team={team}
          coach
          evaluations={evaluations}
          draft={draft}
          setDraft={setDraft}
        />
      ) : tab === "players" ? (
        <>
          <Section title="Ajouter une joueuse">
            <SaveForm
              key={formKey}
              disabled={team.busy || team.offline}
              label="Ajouter"
              onSave={async (f) => {
                await team.mutate("add_player", Object.fromEntries(f));
                setFormKey((k) => k + 1);
              }}
            >
              <div className="form-grid">
                <Field label="Nom" name="name" required />
                <Field label="Numéro de maillot" name="number" maxLength={10} />
              </div>
            </SaveForm>
          </Section>
          {team.data.players.map((p) => (
            <PlayerEditor
              key={p.id}
              player={p}
              team={team}
              password={password}
              evaluationsReady={evaluations !== null}
              evaluation={evaluations?.[p.id]}
              saveEvaluation={async (scores) => {
                const result = await request("save_player_evaluation", {
                  id: p.id,
                  scores,
                  password,
                });
                setEvaluations((old) => ({ ...old, [p.id]: result.scores }));
                setDraft((old) => ({ ...old, result: null }));
              }}
            />
          ))}
        </>
      ) : tab === "trainings" ? (
        <Section title="Entraînements enregistrés">
          {team.data.trainings.map((t) => (
            <TrainingEditor
              key={t.id}
              training={t}
              team={team}
              password={password}
            />
          ))}
        </Section>
      ) : (
        <Section title="Modifier le mot de passe">
          <SaveForm
            key={formKey}
            onSave={async (f) => {
              if (f.get("new_password") !== f.get("confirmation"))
                throw new Error(
                  "Les nouveaux mots de passe ne correspondent pas.",
                );
              await request("change_coach_password", {
                old_password: f.get("old_password"),
                new_password: f.get("new_password"),
              });
              lock();
            }}
          >
            <Field
              label="Ancien mot de passe"
              type="password"
              name="old_password"
              autoComplete="current-password"
              required
            />
            <Field
              label="Nouveau mot de passe"
              type="password"
              name="new_password"
              autoComplete="new-password"
              required
            />
            <Field
              label="Confirmer le nouveau mot de passe"
              type="password"
              name="confirmation"
              autoComplete="new-password"
              required
            />
          </SaveForm>
        </Section>
      )}
    </>
  );
}

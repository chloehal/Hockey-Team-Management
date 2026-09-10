import { useState } from "react";
import {
  Heading,
  Section,
  Field,
  Choice,
  SaveForm,
  Confirm,
  Button,
  dateLabel,
} from "../components/shared";
import { request } from "../lib/api";
import { POS_FULL_LABELS } from "../lib/selection";
import Match from "./Match";
function PlayerEditor({ player, team }) {
  const [positions, setPositions] = useState([
      player.position_1 || "",
      player.position_2 || "",
      player.position_3 || "",
    ]),
    [level, setLevel] = useState(String(player.level || 2));
  return (
    <Section
      title={`${player.number ? `#${player.number} · ` : ""}${player.name}`}
    >
      <SaveForm
        disabled={team.busy || team.offline}
        onSave={() =>
          team.mutate("update_player_details", {
            id: player.id,
            position_1: positions[0] || null,
            position_2: positions[1] || null,
            position_3: positions[2] || null,
            level: Number(level),
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
          <Choice
            label="Niveau"
            value={level}
            onChange={setLevel}
            options={[
              ["1", "1 · Confirmée"],
              ["2", "2 · Intermédiaire"],
              ["3", "3 · En progression"],
            ]}
          />
        </div>
      </SaveForm>
      <Confirm
        title={`Supprimer ${player.name} ?`}
        disabled={team.busy || team.offline}
        onConfirm={() => team.mutate("delete_player", { id: player.id })}
      />
    </Section>
  );
}
export default function Coach({ team, draft, setDraft }) {
  const [unlocked, setUnlocked] = useState(false),
    [tab, setTab] = useState("players"),
    [formKey, setFormKey] = useState(0);
  if (!unlocked)
    return (
      <>
        <Heading
          title="Espace coach."
          description="Retrouve les postes, les niveaux et les outils de sélection."
        />
        <Section title="Accès coach">
          <SaveForm
            label="Ouvrir l’espace coach"
            onSave={async (f) => {
              const result = await request("verify_coach_password", {
                password: f.get("password"),
              });
              if (!result.ok) throw new Error("Mot de passe incorrect.");
              setUnlocked(true);
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
        <Button variant="outline" onClick={() => setUnlocked(false)}>
          Verrouiller
        </Button>
      </Heading>
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
        <Match team={team} coach draft={draft} setDraft={setDraft} />
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
            <PlayerEditor key={p.id} player={p} team={team} />
          ))}
        </>
      ) : tab === "trainings" ? (
        <Section title="Entraînements enregistrés">
          {team.data.trainings.map((t) => (
            <div className="list-row" key={t.id}>
              <div>
                <strong>{dateLabel(t.date)}</strong>
                <p className="muted">{t.presentIds.length} présentes</p>
              </div>
              <Confirm
                title="Supprimer cette séance et ses présences ?"
                disabled={team.busy || team.offline}
                onConfirm={() => team.mutate("delete_training", { id: t.id })}
              />
            </div>
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
              setUnlocked(false);
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

import { useState } from "react";
import {
  Heading,
  Section,
  Button,
  Field,
  SaveForm,
  Confirm,
  Empty,
  dateLabel,
} from "../components/shared";
import { MATCH_DATES, CALENDAR_URL } from "../lib/content";
export default function Team({ team }) {
  const { data, mutate, busy, offline } = team;
  const [message, setMessage] = useState(false),
    [note, setNote] = useState(""),
    [refDate, setRefDate] = useState(MATCH_DATES[0]?.date || ""),
    [copy, setCopy] = useState("");
  const next = MATCH_DATES.find(
    (m) => m.date >= new Date().toLocaleDateString("sv-SE"),
  );
  return (
    <>
      <Heading
        title="La vie de l’équipe."
        description="Les infos à partager, les rendez-vous et l’arbitrage."
      />
      <div className="metrics">
        <Section title="Effectif">
          <strong className="metric">{data.players.length}</strong>
          <p className="muted">joueuses</p>
        </Section>
        <Section title="Prochain match">
          <strong className="metric smaller">
            {next ? dateLabel(next.date) : "À venir"}
          </strong>
          <p className="muted">
            {next
              ? `${next.time} · pense à tes disponibilités`
              : "Aucune date future renseignée"}
          </p>
        </Section>
        <Section title="Entraînements">
          <strong className="metric">{data.trainings.length}</strong>
          <p className="muted">séances enregistrées</p>
        </Section>
      </div>
      <div className="two-columns">
        <div className="stack">
          <Section
            title="Au vestiaire"
            description="Les messages de l’équipe."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMessage(!message)}
              >
                Écrire
              </Button>
            }
          >
            {!data.messages.length && (
              <Empty>Aucun message pour le moment.</Empty>
            )}
            {data.messages.map((m) => (
              <article className={`announcement ${m.icon}`} key={m.id}>
                <h3>{m.title || "Message"}</h3>
                <p>{m.text}</p>
                <Confirm
                  title="Supprimer ce message ?"
                  disabled={busy || offline}
                  onConfirm={() => mutate("delete_important_msg", { id: m.id })}
                />
              </article>
            ))}
            {message && (
              <SaveForm
                disabled={busy || offline}
                label="Publier"
                onSave={async (f) => {
                  await mutate("save_important_msg", Object.fromEntries(f));
                  setMessage(false);
                }}
              >
                <Field label="Titre" name="title" required />
                <Field label="Message">
                  <textarea className="control" name="text" required />
                </Field>
                <Field label="Type">
                  <select className="control" name="icon">
                    <option value="info">Information</option>
                    <option value="warning">Important</option>
                    <option value="success">Bonne nouvelle</option>
                    <option value="error">Alerte</option>
                  </select>
                </Field>
              </SaveForm>
            )}
          </Section>
          <Section title="Notes partagées">
            {data.notes.map((n) => (
              <div className="list-row" key={n.id}>
                <p className="note-text">{n.text}</p>
                <Confirm
                  title="Supprimer cette note ?"
                  disabled={busy || offline}
                  onConfirm={() => mutate("delete_note", { id: n.id })}
                />
              </div>
            ))}
            <SaveForm
              label="Ajouter la note"
              disabled={busy || offline}
              onSave={async () => {
                await mutate("add_note", { text: note.trim() });
                setNote("");
              }}
            >
              <Field label="Nouvelle note">
                <textarea
                  className="control"
                  required
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
            </SaveForm>
          </Section>
        </div>
        <Section title="Arbitrage" description="Deux arbitres par rencontre.">
          {MATCH_DATES.map((m) => {
            const refs = data.referees.filter((r) => r.date === m.date);
            return (
              <div className="ref-date" key={m.date}>
                <div className="section-header">
                  <h3>
                    {dateLabel(m.date)} · {m.time}
                  </h3>
                  <span
                    className="referee-count"
                    data-complete={refs.length === 2}
                    aria-label={`${refs.length} arbitres inscrits sur 2`}
                  >
                    {refs.length}/2
                  </span>
                </div>
                {refs.map((r) => (
                  <div className="list-row" key={r.id}>
                    <div>
                      <strong>{r.name}</strong>
                      {r.phone && (
                        <p>
                          <a href={`tel:${r.phone}`}>{r.phone}</a>
                        </p>
                      )}
                    </div>
                    <Confirm
                      title="Retirer cet arbitre ?"
                      disabled={busy || offline}
                      onConfirm={() => mutate("delete_referee", { id: r.id })}
                    />
                  </div>
                ))}
              </div>
            );
          })}
          <Button
            className="w-full"
            variant="outline"
            disabled={MATCH_DATES.every(
              (m) => data.referees.filter((r) => r.date === m.date).length >= 2,
            )}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  MATCH_DATES.filter(
                    (m) =>
                      data.referees.filter((r) => r.date === m.date).length < 2,
                  )
                    .map((m) => `${dateLabel(m.date)} ${m.time}`)
                    .join(", "),
                );
                setCopy("Dates copiées.");
              } catch {
                setCopy(
                  "La copie a échoué. Autorise l’accès au presse-papiers.",
                );
              }
            }}
          >
            Copier les dates à couvrir
          </Button>
          {copy && <p role="status">{copy}</p>}
          <SaveForm
            label="Inscrire un arbitre"
            disabled={
              busy ||
              offline ||
              data.referees.filter((r) => r.date === refDate).length >= 2
            }
            onSave={async (f) => {
              await mutate("add_referee", Object.fromEntries(f));
            }}
          >
            <Field label="Rencontre">
              <select
                className="control"
                name="date"
                value={refDate}
                onChange={(e) => setRefDate(e.target.value)}
              >
                {MATCH_DATES.map((m) => (
                  <option key={m.date} value={m.date}>
                    {dateLabel(m.date)} · {m.time}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nom" name="name" required />
            <Field label="Téléphone" name="phone" type="tel" />
          </SaveForm>
        </Section>
      </div>
      <Section
        title="Calendrier de l’équipe"
        action={
          <a
            className="muted underline"
            href={CALENDAR_URL}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir le calendrier
          </a>
        }
      >
        <iframe
          className="calendar"
          title="Calendrier Google des Panthères"
          src={CALENDAR_URL}
          loading="lazy"
        />
      </Section>
    </>
  );
}

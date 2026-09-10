import { useEffect, useState } from "react";
import {
  Heading,
  Section,
  Field,
  SaveForm,
  Checklist,
  Empty,
  dateLabel,
  today,
} from "../components/shared";
export default function Attendance({ team }) {
  const { data, mutate, busy, offline } = team;
  const [date, setDate] = useState(today),
    [selected, setSelected] = useState([]);
  useEffect(() => {
    setSelected(
      (data.trainings.find((t) => t.date === date)?.presentIds || []).map(
        String,
      ),
    );
  }, [date, data.trainings]);
  return (
    <>
      <Heading
        title="Présentes sur le terrain."
        description="Un pointage par séance, partagé avec toute l’équipe."
      />
      <Section
        title="Enregistrer les présences"
        description={
          data.trainings.some((t) => t.date === date)
            ? "Une séance existe à cette date. Enregistrer mettra ses présences à jour."
            : "Sélectionne la date et les joueuses présentes."
        }
      >
        <SaveForm
          disabled={busy || offline}
          onSave={() => mutate("save_training", { date, presentIds: selected })}
        >
          <Field
            label="Date de l’entraînement"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Checklist
            players={data.players}
            selected={selected}
            setSelected={setSelected}
          />
        </SaveForm>
      </Section>
      <Section
        title="Historique des présences"
        description="Les séances les plus récentes à droite."
      >
        {!data.trainings.length ? (
          <Empty>Aucune séance enregistrée.</Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Joueuse</th>
                  {data.trainings.map((t) => (
                    <th key={t.id}>{dateLabel(t.date)}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((p) => (
                  <tr key={p.id}>
                    <th>{p.name}</th>
                    {data.trainings.map((t) => (
                      <td
                        key={t.id}
                        aria-label={`${p.name} ${t.date} ${t.presentIds.map(String).includes(String(p.id)) ? "présente" : "absente"}`}
                      >
                        {t.presentIds.map(String).includes(String(p.id))
                          ? "✓"
                          : "—"}
                      </td>
                    ))}
                    <td>
                      {
                        data.trainings.filter((t) =>
                          t.presentIds.map(String).includes(String(p.id)),
                        ).length
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

import {
  Heading,
  Section,
  Button,
  Empty,
  dateLabel,
} from "../components/shared";
export default function Attendance({ team, onTakeAttendance }) {
  const { data } = team;
  return (
    <>
      <Heading
        title="Présences aux entraînements."
        description="Un pointage par séance, partagé avec toute l’équipe."
      />
      <Section
        title="Enregistrer les présences"
        description="Le pointage rapide est accessible sur toutes les pages. Ta saisie est conservée pendant le chargement."
      >
        <Button onClick={onTakeAttendance}>Ouvrir le pointage</Button>
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

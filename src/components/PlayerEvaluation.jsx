import { useState } from "react";
import { Field, SaveForm } from "./shared";
import {
  CRITERIA,
  emptyEvaluation,
  evaluationSummary,
  normalizeEvaluation,
} from "../lib/evaluations";
export default function PlayerEvaluation({ initial, save, disabled }) {
  const [scores, setScores] = useState(() => initial || emptyEvaluation()),
    [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false);
  let summary;
  try {
    summary = evaluationSummary(scores);
  } catch {
    summary = { count: 0, average: null };
  }
  return (
    <div className="player-evaluation">
      <div className="section-header">
        <div>
          <h3>Évaluation</h3>
          <p className="muted">Sept critères sur 10, de même poids.</p>
        </div>
        <div className="evaluation-average" aria-live="polite">
          <strong>
            {summary.average === null
              ? "—"
              : new Intl.NumberFormat("fr-BE", {
                  maximumFractionDigits: 1,
                }).format(summary.average)}
            <small> /10</small>
          </strong>
          <span>
            {summary.average === null
              ? `${summary.count}/7 critères renseignés`
              : "Moyenne générale"}
          </span>
        </div>
      </div>
      <SaveForm
        label="Enregistrer l’évaluation"
        disabled={disabled}
        onSave={async () => {
          const normalized = normalizeEvaluation(scores);
          setSaving(true);
          try {
            await save(normalized);
            setScores(normalized);
            setSaved(true);
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="evaluation-grid">
          {CRITERIA.map(([key, label]) => (
            <Field
              key={key}
              label={label}
              disabled={disabled || saving}
              type="number"
              inputMode="decimal"
              min="0"
              max="10"
              step="any"
              placeholder="Non notée"
              value={scores[key] ?? ""}
              onChange={(e) => {
                setScores({ ...scores, [key]: e.target.value });
                setSaved(false);
              }}
            />
          ))}
        </div>
        <p className="muted">
          La moyenne est calculée lorsque les sept critères sont renseignés. Une
          case vide ne compte pas comme zéro.
        </p>
      </SaveForm>
      {saved && (
        <p className="status" role="status">
          Évaluation enregistrée.
        </p>
      )}
    </div>
  );
}

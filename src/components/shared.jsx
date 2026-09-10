import { cloneElement, useId, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
export {
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
};
export function Section({ title, description, children, action }) {
  return (
    <Card>
      <CardHeader>
        <div className="section-header">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && (
              <CardDescription className="mt-2">{description}</CardDescription>
            )}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
export function Heading({
  eyebrow = "LES PANTHÈRES",
  title,
  description,
  children,
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children}
    </header>
  );
}
export function Field({ label, children, ...props }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {children ? cloneElement(children, { id }) : <Input id={id} {...props} />}
    </label>
  );
}
export function Choice({ label, value, onChange, options, disabled = false }) {
  return (
    <Field label={label}>
      <select
        className="control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function Empty({ children = "Rien à afficher pour le moment." }) {
  return <p className="empty">{children}</p>;
}
export function SaveForm({
  onSave,
  children,
  label = "Enregistrer",
  disabled = false,
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          await onSave(new FormData(e.currentTarget));
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || disabled}>
        {busy ? "Enregistrement…" : label}
      </Button>
    </form>
  );
}
export function Confirm({ title, onConfirm, disabled = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Supprimer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Cette suppression sera enregistrée pour toute l’équipe.
            </DialogDescription>
          </DialogHeader>
          <SaveForm
            label="Confirmer la suppression"
            disabled={disabled}
            onSave={async () => {
              await onConfirm();
              setOpen(false);
            }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
          </SaveForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function Checklist({ players, selected, setSelected }) {
  const [search, setSearch] = useState("");
  const shown = players.filter((p) =>
    p.name.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")),
  );
  return (
    <div className="stack">
      <Input
        aria-label="Rechercher une joueuse"
        placeholder="Rechercher une joueuse…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="toolbar">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setSelected(players.map((p) => String(p.id)))}
        >
          Toutes
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setSelected([])}
        >
          Aucune
        </Button>
        <span className="muted">{selected.length} sélectionnées</span>
      </div>
      <div className="check-grid">
        {shown.map((p) => (
          <label className="player-check" key={p.id}>
            <input
              type="checkbox"
              checked={selected.includes(String(p.id))}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, String(p.id)]
                    : selected.filter((id) => id !== String(p.id)),
                )
              }
            />
            <span className="shirt">{p.number || "—"}</span>
            <span>{p.name}</span>
          </label>
        ))}
      </div>
      {!shown.length && <Empty />}
    </div>
  );
}
export function dateLabel(date) {
  return new Intl.DateTimeFormat("fr-BE", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

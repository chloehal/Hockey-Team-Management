import { useEffect } from "react";
import { ClipboardCheck, LoaderCircle, CircleCheck } from "lucide-react";
import { Button, Field, Checklist, dateLabel } from "./shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
export default function QuickAttendance({ team, open, onOpenChange }) {
  const {
    attendanceDraft: draft,
    attendanceStatus: status,
    attendanceError: error,
  } = team;
  const pending = status === "waiting" || status === "saving";
  const success = status === "success";
  const existing = team.data.trainings.some((t) => t.date === draft.date);
  useEffect(() => {
    if (!pending) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);
  function changeOpen(next) {
    if (pending) return;
    if (next) team.resetAttendanceStatus();
    onOpenChange(next);
  }
  return (
    <>
      <Button
        className="quick-attendance-trigger no-print"
        onClick={() => changeOpen(true)}
      >
        <ClipboardCheck size={18} />
        <span>Prendre les présences</span>
      </Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent
          className="attendance-dialog"
          showCloseButton={!pending}
          onEscapeKeyDown={(e) => {
            if (pending) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (pending) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {success ? "Présences enregistrées" : "Prendre les présences"}
            </DialogTitle>
            <DialogDescription>
              {success
                ? "La sauvegarde est confirmée par le serveur. Tu peux quitter la page."
                : "Coche les joueuses présentes. Ton brouillon est conservé sur cet appareil."}
            </DialogDescription>
          </DialogHeader>
          {pending ? (
            <div
              className="attendance-feedback"
              role="status"
              aria-live="polite"
            >
              <LoaderCircle
                className="attendance-spinner"
                size={36}
                aria-hidden="true"
              />
              <strong>
                {status === "waiting"
                  ? "Chargement de la base de données…"
                  : "Enregistrement des présences…"}
              </strong>
              <p>
                {status === "waiting"
                  ? "Ne quitte pas la page. Tes présences seront envoyées dès que la connexion sera prête."
                  : "Ne quitte pas la page. Nous attendons la confirmation de l’enregistrement."}
              </p>
            </div>
          ) : success ? (
            <div className="attendance-feedback">
              <CircleCheck
                size={40}
                className="attendance-success"
                aria-hidden="true"
              />
              <p>
                {dateLabel(draft.date)} · {draft.selected.length} présence
                {draft.selected.length > 1 ? "s" : ""} enregistrée
                {draft.selected.length > 1 ? "s" : ""}.
              </p>
              <Button onClick={() => changeOpen(false)}>Terminé</Button>
            </div>
          ) : (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                team.saveAttendance();
              }}
            >
              <Field
                label="Date de l’entraînement"
                type="date"
                required
                value={draft.date}
                onChange={(e) => team.setAttendanceDate(e.target.value)}
              />
              {!team.presenceReady && team.hasPlayers && (
                <p className="muted">
                  Tu peux déjà cocher les présences. Les données seront
                  vérifiées avant l’envoi.
                </p>
              )}
              {!team.hasPlayers ? (
                <div role="status" className="attendance-feedback">
                  <LoaderCircle
                    className="attendance-spinner"
                    aria-hidden="true"
                  />
                  <p>
                    {team.loading
                      ? "Premier chargement de la liste des joueuses…"
                      : "La liste des joueuses n’a pas pu être chargée."}
                  </p>
                  {!team.loading && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={team.refresh}
                    >
                      Réessayer le chargement
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {existing && (
                    <p className="muted">
                      Cette séance est déjà enregistrée. Seul le coach peut
                      modifier ses présences depuis l’espace coach, rubrique «
                      Séances ».
                    </p>
                  )}
                  {!existing && (
                    <Checklist
                      players={team.data.players}
                      selected={draft.selected}
                      setSelected={team.setAttendanceSelected}
                    />
                  )}
                </>
              )}
              {error && (
                <p role="alert" className="error">
                  {error} Ta saisie est conservée.
                </p>
              )}
              <div className="attendance-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => changeOpen(false)}
                >
                  Fermer
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !team.hasPlayers ||
                    !team.data.players.length ||
                    team.busy ||
                    !draft.date ||
                    existing
                  }
                >
                  {status === "error"
                    ? "Réessayer l’enregistrement"
                    : "Enregistrer les présences"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

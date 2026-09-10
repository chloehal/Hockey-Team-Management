import { useEffect, useState } from "react";
import { House, ClipboardCheck, Users, BookOpen } from "lucide-react";
import { useTeam } from "./hooks/useTeam";
import { Button, Heading, Section } from "./components/shared";
import Team from "./pages/Team";
import Attendance from "./pages/Attendance";
import Match from "./pages/Match";
import Coach from "./pages/Coach";
import Rules from "./pages/Rules";
const routes = [
  ["team", "Équipe", House],
  ["attendance", "Présences", ClipboardCheck],
  ["match", "Match", Users],
  ["rules", "Fonctionnement", BookOpen],
];
const routeNow = () =>
  location.hash.slice(2) ||
  (/\/coach(?:\.html)?$/.test(location.pathname) ? "coach" : "team");
export default function App() {
  const team = useTeam(),
    [route, setRoute] = useState(routeNow),
    [matchDraft, setMatchDraft] = useState({ available: [], result: null }),
    [coachDraft, setCoachDraft] = useState({ available: [], result: null });
  useEffect(() => {
    const change = () => {
      setRoute(routeNow());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return (
    <div className="app">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main").focus();
        }}
      >
        Aller au contenu
      </a>
      <aside className="sidebar">
        <a className="brand" href="#/team">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <span>
            les panthères<small>LE COLLECTIF</small>
          </span>
        </a>
        <p className="sidebar-label">ESPACE ÉQUIPE</p>
        <nav aria-label="Navigation principale">
          {routes.map(([key, label, Icon]) => (
            <a
              href={`#/${key}`}
              key={key}
              aria-current={route === key ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" />
          Une équipe. Un terrain.
        </div>
      </aside>
      <header className="mobile-header">
        <a className="brand" href="#/team">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          les panthères
        </a>
      </header>
      <main id="main" tabIndex={-1}>
        {import.meta.env.DEV && import.meta.env.VITE_DEMO === "true" && (
          <p className="demo-banner">Aperçu · données de démonstration</p>
        )}
        {team.notice && (
          <p className="notice" role="status">
            {team.notice}
          </p>
        )}
        {team.error && (
          <div role="alert" className="error">
            {team.error}
            {team.offline && (
              <p>
                Les données affichées peuvent être anciennes. Les modifications
                sont désactivées.
              </p>
            )}
            <Button variant="outline" onClick={team.refresh}>
              Réessayer
            </Button>
          </div>
        )}
        {team.loading ? (
          <p role="status">Chargement de l’équipe…</p>
        ) : route === "attendance" ? (
          <Attendance team={team} />
        ) : route === "match" ? (
          <Match team={team} draft={matchDraft} setDraft={setMatchDraft} />
        ) : route === "coach" ? (
          <Coach team={team} draft={coachDraft} setDraft={setCoachDraft} />
        ) : route === "rules" ? (
          <>
            <Heading
              title="Notre fonctionnement."
              description="Les repères communs pour la saison."
            />
            <Section title="Les règles du collectif">
              <Rules />
            </Section>
          </>
        ) : (
          <Team team={team} />
        )}
      </main>
      <nav className="mobile-nav" aria-label="Navigation mobile">
        {routes.map(([key, label, Icon]) => (
          <a
            href={`#/${key}`}
            key={key}
            aria-current={route === key ? "page" : undefined}
          >
            <Icon size={20} />
            <span>{label === "Fonctionnement" ? "Infos" : label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

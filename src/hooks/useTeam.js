import { useCallback, useEffect, useRef, useState } from "react";
import { emptyTeam, loadTeam, request } from "../lib/api";
const CACHE = "pantheres-react-team-v1";
function cached() {
  try {
    const data = JSON.parse(localStorage.getItem(CACHE));
    return data &&
      Object.keys(emptyTeam).every((key) => Array.isArray(data[key])) &&
      data.trainings.every((t) => Array.isArray(t.presentIds))
      ? data
      : null;
  } catch {
    return null;
  }
}
export function useTeam() {
  const [data, setData] = useState(() => cached() || emptyTeam),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [offline, setOffline] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const next = await loadTeam();
      setData(next);
      setError("");
      setOffline(false);
      try {
        localStorage.setItem(CACHE, JSON.stringify(next));
      } catch {}
      return true;
    } catch (e) {
      setError(e.message);
      setOffline(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  async function mutate(action, payload) {
    if (lock.current) throw new Error("Une sauvegarde est déjà en cours.");
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      await request(action, payload);
      const refreshed = await refresh();
      setNotice(
        refreshed
          ? "Enregistré."
          : "Enregistré sur le serveur. Actualise pour voir les dernières données.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { data, loading, error, offline, busy, notice, refresh, mutate };
}

import { useEffect, useSyncExternalStore } from "react";
import { getTeamStore } from "../lib/team-store";
export function useTeam() {
  const store = getTeamStore();
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    store.refresh();
  }, [store]);
  return {
    ...state,
    refresh: store.refresh,
    mutate: store.mutate,
    setAttendanceDate: store.setAttendanceDate,
    setAttendanceSelected: store.setAttendanceSelected,
    saveAttendance: store.saveAttendance,
    resetAttendanceStatus: store.resetAttendanceStatus,
  };
}

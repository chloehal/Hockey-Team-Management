import { GROUP_LABELS, POS_GROUPS, POS_FULL_LABELS } from "./selection";
export async function exportMatch(result) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 180 + result.selected.length * 60;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#18181b";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText("LES PANTHÈRES · Feuille de match", 40, 60);
  ctx.font = "20px sans-serif";
  ctx.fillText(new Date().toLocaleDateString("fr-BE"), 40, 100);
  const rows = [...result.selected].sort(
    (a, b) => (a._zone === "bench") - (b._zone === "bench"),
  );
  rows.forEach((p, i) => {
    const y = 150 + i * 60;
    ctx.fillStyle = i % 2 ? "#fafafa" : "#f4f4f5";
    ctx.fillRect(30, y - 28, 1140, 58);
    ctx.fillStyle = "#18181b";
    ctx.font = "22px sans-serif";
    ctx.fillText(String(p.number || "—"), 45, y + 8);
    ctx.fillText(p.name, 120, y + 8, 480);
    ctx.font = "17px sans-serif";
    ctx.fillText(
      `${p._zone === "bench" ? "Banc" : "Terrain"} · ${POS_FULL_LABELS[p._role] || GROUP_LABELS[p._fieldPos || POS_GROUPS[p.position_1]] || "—"}`,
      640,
      y + 8,
    );
    ctx.fillText(
      `${p.pres3}/${result.maxT3} · ${p.pres5}/${result.maxT5}`,
      990,
      y + 8,
    );
  });
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Export impossible");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pantheres-feuille-match.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

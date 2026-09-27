import { test, expect } from "@playwright/test";
import { demoTeam, demoResponse } from "./fixtures";
test.beforeEach(async ({ page }) => {
  const data = structuredClone(demoTeam);
  await page.route("**/api.php?*", async (route) => {
    const result = demoResponse(
      data,
      new URL(route.request().url()).searchParams.get("action"),
      route.request().postDataJSON() || {},
    );
    await route.fulfill({ status: result.error ? 400 : 200, json: result });
  });
});
test("navigation et absence de débordement sur mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: /coach/i })).toHaveCount(0);
  for (const [route, title] of [
    ["team", "La vie de l’équipe."],
    ["attendance", "Présences aux entraînements."],
    ["match", "La feuille de match."],
    ["rules", "Notre fonctionnement."],
    ["coach", "Espace coach."],
  ]) {
    await page.goto(`/#/${route}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("enregistrer une séance et retrouver ses présences", async ({ page }) => {
  await page.goto("/#/attendance");
  await page
    .getByRole("button", { name: "Prendre les présences", exact: true })
    .click();
  await page.getByLabel("Date de l’entraînement").fill("2026-09-10");
  await page.getByRole("button", { name: "Toutes", exact: true }).click();
  await page
    .getByRole("button", { name: "Enregistrer les présences", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Présences enregistrées", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Terminé", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "10 sept." }),
  ).toBeVisible();
});
test("sélection avec choix de gardienne et accès coach", async ({ page }) => {
  await page.goto("/#/match");
  await page.getByRole("button", { name: "Toutes", exact: true }).click();
  await page.getByRole("button", { name: "Générer la sélection" }).click();
  await page.getByRole("button", { name: "Valider la répartition" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Alice Martin", exact: true })
    .click();
  await expect(page.getByText(/La sélection ·/)).toBeVisible();
  expect(await page.locator(".pitch-player").count()).toBeLessThanOrEqual(16);
  await page.goto("/coach.html");
  await page.getByLabel("Mot de passe coach", { exact: true }).fill("demo");
  await page.getByRole("button", { name: "Ouvrir l’espace coach" }).click();
  await expect(
    page.getByRole("heading", { name: "Côté coach." }),
  ).toBeVisible();
});
test("une sauvegarde refusée conserve la saisie", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Écrire", exact: true }).click();
  await page.getByLabel("Titre", { exact: true }).fill("Message conservé");
  await page.getByLabel("Message", { exact: true }).fill("Contenu");
  await page.route("**/api.php?action=save_important_msg", (r) =>
    r.fulfill({ status: 500, json: { error: "Échec temporaire" } }),
  );
  await page.getByRole("button", { name: "Publier", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Échec temporaire");
  await expect(page.getByLabel("Titre", { exact: true })).toHaveValue(
    "Message conservé",
  );
});

test("la feuille reste disponible après un changement d’onglet", async ({
  page,
}) => {
  await page.goto("/#/match");
  await page.getByRole("button", { name: "Toutes", exact: true }).click();
  await page.getByRole("button", { name: "Générer la sélection" }).click();
  await page.getByRole("button", { name: "Valider la répartition" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Alice Martin", exact: true })
    .click();
  const count = await page.locator(".pitch-player").count();
  await page
    .getByRole("navigation", { name: "Navigation mobile" })
    .getByRole("link", { name: "Présences", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Présences aux entraînements." })
    .waitFor();
  await page
    .getByRole("navigation", { name: "Navigation mobile" })
    .getByRole("link", { name: "Match", exact: true })
    .click();
  await expect(page.locator(".pitch-player")).toHaveCount(count);
  await expect(
    page.getByText("19 sélectionnées", { exact: true }),
  ).toBeVisible();
});

test("les sept notes et leur moyenne sont enregistrées uniquement côté coach", async ({
  page,
}) => {
  await page.goto("/coach.html");
  await page.getByLabel("Mot de passe coach", { exact: true }).fill("demo");
  await page.getByRole("button", { name: "Ouvrir l’espace coach" }).click();
  const editor = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("#1 · Alice Martin", { exact: true }) });
  await expect(
    editor.getByLabel("Technique", { exact: true }),
  ).not.toBeVisible();
  await editor.locator("summary").click();
  for (const label of [
    "Technique",
    "Physique",
    "Stratégie",
    "Placement",
    "Esprit d’équipe",
    "Puissance",
    "Précision",
  ])
    await editor.getByLabel(label, { exact: true }).fill("8");
  await editor.locator("summary").click();
  await editor.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(editor.getByLabel("Technique", { exact: true })).toHaveValue(
    "8",
  );
  await expect(editor.locator(".evaluation-average")).toContainText("8 /10");
  await editor
    .getByRole("button", { name: "Enregistrer l’évaluation" })
    .click();
  await expect(editor.getByRole("status")).toHaveText(
    "Évaluation enregistrée.",
  );
  await page.reload();
  await page.getByLabel("Mot de passe coach", { exact: true }).fill("demo");
  await page.getByRole("button", { name: "Ouvrir l’espace coach" }).click();
  await expect(editor.locator("summary")).toContainText("8 /10");
  await editor.locator("summary").click();
  await expect(editor.getByLabel("Précision", { exact: true })).toHaveValue(
    "8",
  );
  const cache = await page.evaluate(() => JSON.stringify(localStorage));
  expect(cache).not.toContain("esprit_equipe");
  expect(cache).not.toContain('"password"');
});

test("configurer les effectifs avant de générer et bloquer les dépassements", async ({
  page,
}) => {
  await page.goto("/#/match");
  await page.getByRole("button", { name: "Toutes", exact: true }).click();
  await page.getByRole("button", { name: "Générer la sélection" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Répartition de la feuille" }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Terrain : 11/11", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("Banc : 5/5", { exact: true })).toBeVisible();
  await dialog.getByLabel("Terrain · Défense", { exact: true }).fill("5");
  await expect(
    dialog.getByRole("button", { name: "Valider la répartition" }),
  ).toBeDisabled();
  await dialog.getByLabel("Terrain · Défense", { exact: true }).fill("3");
  await dialog.getByLabel("Banc · Défense", { exact: true }).fill("3");
  await expect(
    dialog.getByRole("button", { name: "Valider la répartition" }),
  ).toBeDisabled();
  await dialog.getByLabel("Banc · Défense", { exact: true }).fill("1");
  await expect(
    dialog.getByText("Terrain : 10/11", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("Banc : 4/5", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Valider la répartition" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Alice Martin", exact: true })
    .click();
  await expect(page.getByText(/La sélection ·/)).toBeVisible();
  expect(
    await page.locator(".pitch .pitch-player").count(),
  ).toBeLessThanOrEqual(10);
  expect(
    await page.locator(".match-bench .pitch-player").count(),
  ).toBeLessThanOrEqual(4);
  await expect(page.getByText("Non retenues", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Modifier la répartition" }).click();
  await expect(
    page.getByLabel("Terrain · Défense", { exact: true }),
  ).toHaveValue("3");
});

test("accès rapide : saisir depuis le cache, attendre la base, puis confirmer le vrai enregistrement", async ({
  page,
}) => {
  await page.addInitScript(
    (data) =>
      localStorage.setItem("pantheres-react-team-v1", JSON.stringify(data)),
    demoTeam,
  );
  let releaseRead, releaseWrite;
  const readGate = new Promise((resolve) => (releaseRead = resolve));
  const writeGate = new Promise((resolve) => (releaseWrite = resolve));
  let writes = 0;
  await page.route("**/api.php?action=get_trainings", async (route) => {
    await readGate;
    await route.fallback();
  });
  await page.route("**/api.php?action=save_training", async (route) => {
    writes++;
    await writeGate;
    await route.fallback();
  });
  await page.goto("/#/team");
  await page
    .getByRole("button", { name: "Prendre les présences", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Date de l’entraînement").fill("2026-09-10");
  await dialog
    .getByRole("checkbox", { name: "1 Alice Martin", exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Enregistrer les présences", exact: true })
    .click();
  await expect(
    dialog.getByText("Chargement de la base de données…", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText(
      "Ne quitte pas la page. Tes présences seront envoyées dès que la connexion sera prête.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(writes).toBe(0);
  releaseRead();
  await expect(
    dialog.getByText("Enregistrement des présences…", { exact: true }),
  ).toBeVisible();
  expect(writes).toBe(1);
  releaseWrite();
  await expect(
    dialog.getByRole("heading", {
      name: "Présences enregistrées",
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Terminé", exact: true }).click();
  await page
    .getByRole("button", { name: "Prendre les présences", exact: true })
    .click();
  await expect(
    dialog.getByText(/Seul le coach peut modifier ses présences/),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: "Enregistrer les présences",
      exact: true,
    }),
  ).toBeDisabled();
});

test("les égalités sont annoncées et le raccourci mène aux choix à faire", async ({
  page,
}) => {
  await page.route("**/api.php?action=get_players", (route) =>
    route.fulfill({
      json: [
        { id: 1, name: "Gardienne test", position_1: "gardienne", level: 2 },
        { id: 2, name: "Défense A", position_1: "defense_centrale", level: 2 },
        { id: 3, name: "Défense B", position_1: "defense_laterale", level: 2 },
      ],
    }),
  );
  await page.route("**/api.php?action=get_trainings", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/#/match");
  await page.getByRole("button", { name: "Toutes", exact: true }).click();
  await page
    .getByRole("button", { name: "Générer la sélection", exact: true })
    .click();
  await page.getByLabel("Terrain · Défense", { exact: true }).fill("1");
  await page.getByLabel("Banc · Défense", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "Valider la répartition", exact: true })
    .click();
  const warning = page
    .getByRole("alert")
    .filter({ hasText: "Sélection à compléter" });
  await expect(warning).toContainText("2 joueuses à départager");
  await expect(warning).toBeInViewport();
  await page
    .getByRole("button", { name: "Départager les joueuses", exact: true })
    .click();
  const choices = page.getByRole("region", {
    name: "Joueuses à départager",
    exact: true,
  });
  await expect(choices).toBeFocused();
  await choices
    .getByRole("combobox", { name: "Affectation de Défense A", exact: true })
    .selectOption("field:defense");
  await expect(warning).toContainText("1 joueuse à départager");
  await choices
    .getByRole("combobox", { name: "Affectation de Défense B", exact: true })
    .selectOption("excluded");
  await expect(warning).toHaveCount(0);
});

test("le cas Emma et Mia reste reproductible après actualisation", async ({
  page,
}) => {
  await page.goto("/#/match");
  await page.getByRole("button", { name: "Toutes", exact: true }).click();
  await page
    .getByRole("button", { name: "Générer la sélection", exact: true })
    .click();
  await page.getByLabel("Banc · Défense", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Valider la répartition", exact: true })
    .click();
  await page.getByRole("button", { name: "Alice Martin", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Emma Laurent · Mia Bernard",
  );
  const choices = page.getByRole("region", {
    name: "Joueuses à départager",
    exact: true,
  });
  await expect(choices.getByRole("status")).toContainText(
    "2 joueuses à départager · 1 place à combler",
  );
  await expect(choices.getByRole("status")).toContainText(
    "Banc · Défense : 1 place à combler",
  );
  await page.reload();
  await page.getByRole("button", { name: "Toutes", exact: true }).click();
  await page
    .getByRole("button", { name: "Générer la sélection", exact: true })
    .click();
  await expect(page.getByLabel("Banc · Défense", { exact: true })).toHaveValue(
    "1",
  );
  await page
    .getByRole("button", { name: "Valider la répartition", exact: true })
    .click();
  await page.getByRole("button", { name: "Alice Martin", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Emma Laurent · Mia Bernard",
  );
  await choices
    .getByRole("combobox", { name: "Affectation de Emma Laurent", exact: true })
    .selectOption("bench:defense");
  await expect(choices.getByRole("status")).toContainText(
    "1 joueuse à départager · 0 place à combler",
  );
  await expect(choices.getByRole("status")).toContainText(
    "Toutes les places demandées sont pourvues",
  );
});

test("seul le coach peut corriger une séance et son mot de passe ne reste pas en cache", async ({
  page,
}) => {
  await page.goto("/#/attendance");
  await page
    .getByRole("button", { name: "Prendre les présences", exact: true })
    .click();
  await page.getByLabel("Date de l’entraînement").fill("2026-09-01");
  await expect(
    page
      .getByRole("dialog")
      .getByText(/Seul le coach peut modifier ses présences/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Enregistrer les présences",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("dialog").locator("form").getByRole("button", { name: "Fermer", exact: true }).click();
  await page.goto("/coach.html");
  await page.getByLabel("Mot de passe coach", { exact: true }).fill("demo");
  await page.getByRole("button", { name: "Ouvrir l’espace coach" }).click();
  await page.getByRole("button", { name: "Séances", exact: true }).click();
  await page
    .getByRole("button", { name: "Modifier les présences", exact: true })
    .first()
    .click();
  await page
    .getByRole("checkbox", { name: "1 Alice Martin", exact: true })
    .check();
  const save = page.waitForRequest((request) =>
    request.url().includes("action=save_training"),
  );
  await page
    .getByRole("button", { name: "Enregistrer les présences", exact: true })
    .click();
  expect((await save).postDataJSON().password).toBe("demo");
  await expect(
    page.getByRole("checkbox", { name: "1 Alice Martin", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Modifier les présences", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("checkbox", { name: "1 Alice Martin", exact: true }),
  ).toBeChecked();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    '"password"',
  );
  await page.getByRole("button", { name: "Verrouiller", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Modifier les présences", exact: true }),
  ).toHaveCount(0);
});

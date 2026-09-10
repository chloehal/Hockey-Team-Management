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
  await page.getByLabel("Date de l’entraînement").fill("2026-09-10");
  await page.getByRole("button", { name: "Toutes", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Enregistré.");
  await expect(
    page.getByRole("columnheader", { name: "10 sept." }),
  ).toBeVisible();
});
test("sélection avec choix de gardienne et accès coach", async ({ page }) => {
  await page.goto("/#/match");
  await page.getByRole("button", { name: "Toutes", exact: true }).click();
  await page.getByRole("button", { name: "Générer la sélection" }).click();
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

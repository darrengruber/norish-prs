/**
 * Readable units when scaling (#487), end to end: a scaled amount shows in
 * the unit it reads best in, an amount that lands nowhere neat keeps its
 * unit, and the reader can keep units as written from the Ingredient options
 * menu or from Settings. The choice is a Device Preference, so it is stored
 * for the desktop and survives a reload.
 */
import type { Page } from "@playwright/test";

import { clearDevicePreferences, readDevicePreferences } from "../harness/device-preferences";
import { readRecipe, waitForRecipe } from "../harness/recipes";
import { callTrpc } from "../harness/trpc";
import { expect, test } from "./fixture";

test.describe.configure({ mode: "serial" });

const RECIPE = {
  name: "Readable Units Shortbread",
  description: "A deterministic recipe for the readable units spec.",
  url: "https://example.com/readable-units-shortbread",
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 20,
  totalMinutes: 30,
  systemUsed: "us",
  recipeIngredients: [
    // 8 tbsp at 4 servings is 16 tbsp: a cup.
    { ingredientName: "Butter", ingredientId: null, amount: 8, unit: "tablespoon", order: 0 },
    // 1 tsp at 4 servings is 2 tsp: no whole, half or quarter tablespoon.
    { ingredientName: "Vanilla", ingredientId: null, amount: 1, unit: "teaspoon", order: 1 },
    // 750 ml at 4 servings is 1500 ml: 1.5 litres.
    { ingredientName: "Milk", ingredientId: null, amount: 750, unit: "milliliter", order: 2 },
  ],
  steps: [{ step: "Cream the butter, then bake.", order: 0, systemUsed: "us" }],
  tags: [],
  cuisines: [],
  categories: ["Dessert"],
  images: [],
  videos: [],
};

let recipeId: string;

/** The visible ingredient line naming `name`. */
const line = (page: Page, name: string) =>
  page.locator("li").filter({ hasText: name }).filter({ visible: true }).first();

async function doubleServings(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "2 servings", exact: true })
    .filter({ visible: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Servings" });

  await panel.getByRole("button", { name: "2×" }).click();
  await expect(panel).toBeHidden();
  await expect(
    page.getByRole("button", { name: "4 servings", exact: true }).filter({ visible: true })
  ).toBeVisible();
}

test.beforeAll(async ({ aiStack }) => {
  recipeId = await callTrpc<string>(
    aiStack.baseURL,
    aiStack.ownerCookies,
    "recipes.create",
    RECIPE
  );
  await waitForRecipe(aiStack.baseURL, aiStack.ownerCookies, recipeId);
});

test.beforeEach(async () => {
  await clearDevicePreferences();
});

test.afterAll(async ({ aiStack }) => {
  await clearDevicePreferences();
  const recipe = await readRecipe(aiStack.baseURL, aiStack.ownerCookies, recipeId);

  if (recipe) {
    await callTrpc(aiStack.baseURL, aiStack.ownerCookies, "recipes.delete", {
      recipes: [{ id: recipeId, version: recipe.version }],
    });
  }
});

test("a scaled amount shows in the unit it reads best in, and nothing changes unscaled", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/recipes/${recipeId}`);

  // At the recipe's own servings every line reads as written.
  await expect(line(page, "Butter")).toContainText(/8\s*tablespoons/i);
  await expect(line(page, "Milk")).toContainText(/750\s*milliliters/i);

  await doubleServings(page);

  await expect(line(page, "Butter")).toContainText(/\b1\s*cup\b/i);
  await expect(line(page, "Milk")).toContainText(/1[.,]5\s*liters/i);
  // 2 tsp lands on no neat tablespoon, so it stays in teaspoons.
  await expect(line(page, "Vanilla")).toContainText(/2\s*teaspoons/i);
});

test("keeping units as written from the Ingredient options menu is stored for this device", async ({
  aiStack,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/recipes/${recipeId}`);
  await doubleServings(page);
  await expect(line(page, "Butter")).toContainText(/\b1\s*cup\b/i);

  await page
    .getByRole("button", { name: "Ingredient options", exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole("button", { name: "Keep units as written" }).click();

  await expect(line(page, "Butter")).toContainText(/16\s*tablespoons/i);
  await expect(line(page, "Milk")).toContainText(/1[.,]?500\s*milliliters/i);

  await expect
    .poll(async () => {
      const stored = await readDevicePreferences(aiStack.baseURL, aiStack.ownerCookies);

      return stored.desktop?.readableUnits;
    })
    .toBe(false);

  // The menu now offers the way back, and the choice survives a reload.
  await page.reload();
  await doubleServings(page);
  await expect(line(page, "Butter")).toContainText(/16\s*tablespoons/i);
  await page
    .getByRole("button", { name: "Ingredient options", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("button", { name: "Tidy units when scaling" })).toBeVisible();
});

test("Settings offers the same choice beside how units are written", async ({ aiStack, page }) => {
  await page.goto("/settings/account");

  const scaled = page.getByRole("button", { name: /Scaled units/ });

  await expect(scaled).toContainText("Tidy");
  await scaled.click();
  await page.getByRole("option", { name: "As written", exact: true }).click();

  await expect
    .poll(async () => {
      const stored = await readDevicePreferences(aiStack.baseURL, aiStack.ownerCookies);

      return stored.desktop?.readableUnits;
    })
    .toBe(false);

  await page.goto(`/recipes/${recipeId}`);
  await doubleServings(page);
  await expect(line(page, "Butter")).toContainText(/16\s*tablespoons/i);
});

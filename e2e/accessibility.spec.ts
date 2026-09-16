import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Automated accessibility checks.
 *
 * These exist because the accessibility work on this project was done by
 * reading the code and reasoning about it. That caught real defects, but
 * reasoning is not verification — an assertion that the app is accessible
 * should be something a machine can fail.
 *
 * WCAG 2.1 AA is the bar, which is the level Indian government digital
 * services are expected to meet (GIGW), and the right bar for a product whose
 * whole purpose is making legal information reachable by people who are
 * currently shut out of it.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(TAGS).analyze();
}

/** Readable failure output — axe's default dump is unusable in a diff. */
function describe(results: Awaited<ReturnType<typeof scan>>) {
  return results.violations
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join("\n    ")}`
    )
    .join("\n\n");
}

const PAGES = [
  { path: "/", name: "home" },
  { path: "/analyze", name: "upload" },
  { path: "/compare", name: "compare" },
  { path: "/judgments", name: "judgment search" },
  { path: "/history", name: "history (signed out)" },
];

for (const { path, name } of PAGES) {
  test(`${name} has no WCAG 2.1 AA violations`, async ({ page }) => {
    await page.goto(path);
    const results = await scan(page);
    expect(describe(results)).toBe("");
  });

  test(`${name} has no violations in dark theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(path);
    const results = await scan(page);
    expect(describe(results)).toBe("");
  });
}

test("every page is reachable by keyboard from the skip link", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skip = page.locator("a.skip-link");
  await expect(skip).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeVisible();
});

test("the upload control is focusable, not hidden from assistive tech", async ({
  page,
}) => {
  // Regression: this was display:none, which removed the app's primary
  // action from the accessibility tree entirely.
  await page.goto("/analyze");
  const input = page.locator("#document-upload");
  await expect(input).toBeAttached();
  await input.focus();
  await expect(input).toBeFocused();
});

test("keyboard focus is always visible on interactive controls", async ({ page }) => {
  // Regression: focus:outline-none out-specified the global focus ring.
  await page.goto("/judgments");
  const search = page.getByLabel("Search judgments by subject or party");
  await search.focus();

  const outline = await search.evaluate((el) => {
    const s = getComputedStyle(el);
    return { width: s.outlineWidth, style: s.outlineStyle };
  });
  expect(outline.style).not.toBe("none");
  expect(parseFloat(outline.width)).toBeGreaterThan(0);
});

test("the theme toggle exposes its state and actually switches", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /switch to (light|dark) theme/i });
  await expect(toggle).toHaveAttribute("aria-pressed", /true|false/);

  const before = await page.evaluate(
    () => document.documentElement.getAttribute("data-theme") ?? "system"
  );
  await toggle.click();
  const after = await page.evaluate(
    () => document.documentElement.getAttribute("data-theme") ?? "system"
  );
  expect(after).not.toBe(before);
});

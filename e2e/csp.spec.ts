import { test, expect } from "@playwright/test";

/**
 * Guards the Content Security Policy against the specific way it broke.
 *
 * The CSP was added as a hardening step and it silently killed Google
 * sign-in. Firebase Auth's popup resolver loads Google's gapi client from
 * https://apis.google.com before it makes any network call of its own;
 * script-src did not list that origin, so the browser blocked it, the
 * resolver never initialised, and the SDK surfaced auth/internal-error —
 * an error that names nothing you could act on.
 *
 * Nothing caught it. The whole accessibility suite runs signed out, so it
 * never touched the button, and the app looked entirely healthy from the
 * outside: every page rendered, every other feature worked. The break was
 * invisible until somebody clicked Sign in.
 *
 * Asserting the header rather than driving the sign-in flow is deliberate.
 * A test that clicks through to Google depends on Google being up, on popup
 * behaviour that differs between headless and headed runs, and on credentials
 * CI does not have. This checks the thing that was actually wrong, and it
 * fails for the right reason: someone tightening the policy has to
 * consciously decide about each origin below rather than discover it from a
 * user report.
 */

/** Origins Firebase Auth needs, and what stops working without each. */
const REQUIRED = [
  {
    directive: "script-src",
    origin: "https://apis.google.com",
    breaks: "the popup resolver, so sign-in fails with auth/internal-error",
  },
  {
    directive: "frame-src",
    origin: "https://promptwar-501405.firebaseapp.com",
    breaks: "the auth iframe that carries the OAuth result back",
  },
  {
    directive: "frame-src",
    origin: "https://accounts.google.com",
    breaks: "the Google account chooser",
  },
] as const;

function directiveOf(csp: string, name: string): string {
  const found = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  return found ?? "";
}

test.describe("Content Security Policy", () => {
  test("is actually sent", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["content-security-policy"]).toBeTruthy();
  });

  for (const { directive, origin, breaks } of REQUIRED) {
    test(`${directive} allows ${origin} — without it, ${breaks}`, async ({
      request,
    }) => {
      const csp = (await request.get("/")).headers()["content-security-policy"];
      expect(directiveOf(csp ?? "", directive)).toContain(origin);
    });
  }

  test("still refuses to be framed and blocks plugins", async ({ request }) => {
    // The point of the policy is not to end up permissive by accident while
    // adding origins for Firebase.
    const csp = (await request.get("/")).headers()["content-security-policy"];
    expect(directiveOf(csp ?? "", "frame-ancestors")).toBe(
      "frame-ancestors 'none'"
    );
    expect(directiveOf(csp ?? "", "object-src")).toBe("object-src 'none'");
    expect(directiveOf(csp ?? "", "base-uri")).toBe("base-uri 'self'");
    expect(directiveOf(csp ?? "", "form-action")).toBe("form-action 'self'");
  });

  test("a normal page load triggers no CSP violations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy/i.test(message.text())) {
        violations.push(message.text());
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(violations).toEqual([]);
  });
});

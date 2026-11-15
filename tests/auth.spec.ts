import { test, expect } from "@playwright/test";

// This suite runs against the live Supabase project configured in
// .env.local. It is deliberately read-only / non-mutating with one
// exception: the admin-lockout test writes rows to `login_attempts`, which
// is the intended, by-design side effect of the feature under test (see
// the super-admin login action). Nothing here registers, edits, or
// deletes animal or account data — that requires a disposable test
// account/cleanup and is intentionally left out of this committed suite.

test("landing page loads and offers sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("sign-in rejects bad credentials without crashing", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByRole("heading", { name: "Sign in to VacciTrack" })).toBeVisible();
  await page.getByLabel("Email or username").fill("nonexistent-test-user@example.com");
  await page.getByLabel("Password").fill("wrong-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".form-error")).toBeVisible();
});

test("forgot-password rejects an unknown identifier with a generic error", async ({ page }) => {
  await page.goto("/signin");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByLabel("Email or username").fill("no-such-account-xyz@example.com");
  await page.getByRole("button", { name: "Send reset code" }).click();
  await expect(page.locator(".form-error")).toHaveText("No account found with that email or username.");
});

test("/profile redirects to sign-in when signed out", async ({ page }) => {
  await page.goto("/profile");
  await page.waitForURL("**/signin");
});

test("/settings redirects to sign-in when signed out", async ({ page }) => {
  await page.goto("/settings");
  await page.waitForURL("**/signin");
});

test("hidden admin login locks out after repeated failed attempts", async ({ page }) => {
  await page.goto("/vaccitrack_super_hidden_admin");
  let lastErrorText = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.getByLabel("Username").fill("not-the-real-admin");
    await page.getByLabel("Password").fill("not-the-real-password");
    await page.getByRole("button", { name: /Sign in as Administrator/ }).click();
    const error = page.locator(".admin-login-error");
    await expect(error).toBeVisible();
    lastErrorText = (await error.textContent()) ?? "";
  }
  expect(lastErrorText).toContain("Too many failed attempts");
});

import { chromium } from "playwright";

const BASE = process.env.STORYBOOK_URL ?? "http://localhost:6006";

async function fetchIndex() {
  const res = await fetch(`${BASE}/index.json`);
  if (!res.ok) throw new Error(`Failed to fetch index.json: ${res.status}`);
  return res.json();
}

async function auditStory(page, id, title, name) {
  const url = `${BASE}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`;
  const errors = [];
  const pageErrors = [];

  const onConsole = (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  };
  const onPageError = (err) => {
    pageErrors.push(String(err));
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  try {
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    if (!response || !response.ok()) {
      return {
        id,
        title,
        name,
        status: "http-error",
        detail: `HTTP ${response?.status() ?? "unknown"}`,
      };
    }

    await page.waitForSelector("#storybook-root, #root", {
      state: "attached",
      timeout: 10_000,
    });
    await page.waitForTimeout(500);

    const root = page.locator("#storybook-root, #root").first();
    const rootBox = await root.boundingBox().catch(() => null);

    if (pageErrors.length > 0) {
      return {
        id,
        title,
        name,
        status: "page-error",
        detail: pageErrors.join(" | "),
      };
    }

    const criticalConsole = errors.filter(
      (e) =>
        !e.includes("Encountered a script tag while rendering React") &&
        !e.includes("DEPRECATION WARNING") &&
        !e.includes("Failed to resolve dependency: next/"),
    );

    if (criticalConsole.length > 0) {
      return {
        id,
        title,
        name,
        status: "console-error",
        detail: criticalConsole.join(" | "),
      };
    }

    if (!rootBox || (rootBox.width === 0 && rootBox.height === 0)) {
      return {
        id,
        title,
        name,
        status: "empty-render",
        detail: "Story root has zero dimensions",
      };
    }

    return { id, title, name, status: "ok" };
  } catch (err) {
    return {
      id,
      title,
      name,
      status: "timeout",
      detail: String(err),
    };
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
}

const index = await fetchIndex();
const stories = Object.entries(index.entries)
  .filter(([, entry]) => entry.type === "story")
  .map(([id, entry]) => ({
    id,
    title: entry.title,
    name: entry.name,
  }));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const results = [];
for (const story of stories) {
  const result = await auditStory(page, story.id, story.title, story.name);
  results.push(result);
  const mark = result.status === "ok" ? "✓" : "✗";
  process.stdout.write(`${mark} ${story.title} / ${story.name}\n`);
}

await browser.close();

const failures = results.filter((r) => r.status !== "ok");
console.log("\n--- Summary ---");
console.log(`Total: ${results.length}`);
console.log(`OK: ${results.length - failures.length}`);
console.log(`Failed: ${failures.length}`);

if (failures.length > 0) {
  console.log("\n--- Failures ---");
  for (const f of failures) {
    console.log(`${f.status}\t${f.title} / ${f.name}`);
    console.log(`  ${f.detail ?? ""}`);
  }
  process.exit(1);
}

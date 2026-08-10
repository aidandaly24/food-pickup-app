import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Sidewalk POC", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  const textHtml = html.replaceAll("<!-- -->", "");
  assert.match(html, /<title>Sidewalk — NYC Pickup, Priced Right<\/title>/i);
  assert.match(
    html,
    /<meta property="og:image" content="http:\/\/localhost:3000\/og\.png">/i,
  );
  assert.match(
    html,
    /<meta name="twitter:card" content="summary_large_image">/i,
  );
  assert.match(html, /Real places\./);
  assert.match(html, /Honest totals\./);
  assert.match(html, /OBSERVED DATA/);
  assert.match(textHtml, /25 nearby restaurants/);
  assert.match(textHtml, /46 known ordering links/);
  assert.match(textHtml, /3 basket comparisons/);
  assert.equal(html.match(/data-restaurant-id=/g)?.length, 25);
  assert.match(html, /Sarge/);
  assert.match(html, /Medium Rare Murray Hill/);
  assert.match(html, /Not captured/);
  assert.match(html, /Pio Pio 7/);
  assert.match(html, /Bhatti Indian Grill/);
  assert.match(html, /Kips Bay Deli/);
  assert.match(html, /Two Reubens/);
  assert.match(html, /threshold · 11:36 PM/i);
  assert.match(html, /Uber Eats is cheapest/);
  assert.match(html, /\$17\.80/);
  assert.match(html, /Save .*\$5\.94/);
  assert.match(html, /Signed-in pickup/);
  assert.match(html, /Observed August 9–10, 2026/);
  assert.match(html, /single · 11:12 PM/);
  assert.match(html, /single · 12:43 AM/);
  assert.match(html, /actually walkable/);
  assert.match(html, /OpenStreetMap/);
  assert.match(html, /Sidewalk hands off to the source/);
  assert.match(html, /All 25 panel restaurants support discovery/);
  assert.doesNotMatch(html, /Miso &amp; Main|seeded demonstration data/);
});

test("removes starter-only code and dependencies", async () => {
  const [page, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  await assert.rejects(
    access(new URL("app/_sites-preview/SkeletonPreview.tsx", projectRoot)),
  );
  await assert.rejects(
    access(new URL("app/_sites-preview/preview.css", projectRoot)),
  );
  await assert.rejects(access(new URL("app/demo-data.ts", projectRoot)));
  await access(new URL("../public/og.png", import.meta.url));
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|drizzle/);
});

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Fix 1: Add a standalone /api/funds/update-returns endpoint
const fundsFile = resolve(process.cwd(), "server/src/routes/funds.ts");
let code = readFileSync(fundsFile, "utf-8");

// Find the sync progress route and add update-returns route after it
const syncProgressIdx = code.indexOf('fundsRouter.get("/sync/progress"');
if (syncProgressIdx === -1) {
  console.log("Could not find sync/progress route");
  process.exit(1);
}

// Find the end of the sync/progress route
const syncProgressEnd = code.indexOf("});", syncProgressIdx) + 3;

const updateReturnsRoute = `

// ===== Update 1Y Returns =====
fundsRouter.post("/update-returns", async (_req, res) => {
  res.json({ status: "started" });
  updateAllReturns1y().then(count => {
    console.log("[update-returns] Updated " + count + " funds");
  }).catch(err => console.error("[update-returns] error:", err));
});`;

if (!code.includes("/update-returns")) {
  code = code.slice(0, syncProgressEnd) + updateReturnsRoute + code.slice(syncProgressEnd);
  writeFileSync(fundsFile, code, "utf-8");
  console.log("Added /api/funds/update-returns endpoint");
}

// Fix 2: Also call updateAllReturns1y in the scraper's fullSync Phase 2
const scraperFile = resolve(process.cwd(), "server/src/services/scraper.ts");
let scraper = readFileSync(scraperFile, "utf-8");

// Find where Phase 2 completes and Phase 3 starts
const phase3Idx = scraper.indexOf('syncState.phase = "Phase 3');
if (phase3Idx >= 0 && !scraper.includes("updateAllReturns1y")) {
  // Add import at the top
  scraper = 'import { updateAllReturns1y } from "./update-returns.js";\n' + scraper;
  
  // Add call before Phase 3
  scraper = scraper.slice(0, phase3Idx) + 
    'await updateAllReturns1y().catch(e => console.error("[scraper] returns1y error:", e));\n    ' +
    scraper.slice(phase3Idx);
  writeFileSync(scraperFile, scraper, "utf-8");
  console.log("Added updateAllReturns1y call to fullSync Phase 2");
}

console.log("Done!");

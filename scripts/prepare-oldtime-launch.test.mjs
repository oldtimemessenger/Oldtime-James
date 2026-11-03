import test from "node:test";
import assert from "node:assert/strict";
import { includeLaunchSource } from "./prepare-oldtime-launch.mjs";

test("launch export includes the authoritative web/mobile app, Cloudflare and shared source", () => {
  for (const file of [
    "artifacts/oldtimehive/app/app.js", "artifacts/oldtimehive/public/brand/oldtime-app-icon.png",
    "artifacts/api-server/src/cloudflare/worker.ts", "artifacts/api-server/migrations/0034_status_question_answers.sql",
    "artifacts/oldtime-mobile/app.json", "artifacts/oldtime-mobile/components/OldtimeSurface.native.tsx",
    "lib/api-zod/src/index.ts", "lib/discovery-engine/automatic-topics.js", "pnpm-lock.yaml",
  ]) assert.equal(includeLaunchSource(file), true, file);
});

test("launch export excludes secrets, user data, other apps, history and generated output", () => {
  for (const file of [
    ".env", ".git/config", ".agents/memory/MEMORY.md", "attached_assets/reference.png",
    "artifacts/oldtimehive/.env.production", "artifacts/api-server/.dev.vars",
    "artifacts/api-server/media-data/private.jpg", "artifacts/api-server/.wrangler/state/live.sqlite",
    "artifacts/oldtimehive/dist/public/index.html", "artifacts/oldtime-mobile/.expo/devices.json",
    "artifacts/oldtime-mobile/credentials/key.p8", "artifacts/mockup-sandbox/src/index.tsx",
    "artifacts/oldtime-technologies/app/app.js", "lib/db/src/index.ts",
    "artifacts/api-server/test/places-postgres.integration.ts",
    "/artifacts/oldtimehive/app/app.js", "artifacts/oldtimehive/../../.env",
  ]) assert.equal(includeLaunchSource(file), false, file);
});

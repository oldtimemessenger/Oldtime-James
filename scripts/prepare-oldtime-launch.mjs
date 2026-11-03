import { execFileSync } from "node:child_process";
import { copyFileSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exact = new Set([
  "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc",
  ".gitignore", ".replitignore", "tsconfig.json", "tsconfig.base.json",
]);
const prefixes = [
  "artifacts/oldtimehive/", "artifacts/api-server/", "artifacts/oldtime-mobile/",
  "lib/api-client-react/", "lib/api-zod/", "lib/api-spec/",
  "lib/discovery-engine/", "lib/public-copy/", "lib/sports/",
];
const scripts = new Set([
  "scripts/cloudflare-pages-build.mjs", "scripts/cloudflare-pages-build.test.mjs",
  "scripts/prepare-oldtime-launch.mjs", "scripts/prepare-oldtime-launch.test.mjs",
]);

export function includeLaunchSource(file) {
  if (!file || file.startsWith("/") || file.split("/").includes("..")) return false;
  if (!(exact.has(file) || scripts.has(file) || prefixes.some(prefix => file.startsWith(prefix)))) return false;
  const parts = file.split("/");
  if (parts.some(part => [
    "node_modules", "dist", "build", ".expo", ".expo-shared", ".wrangler",
    ".replit-artifact", "media-data", "coverage", "test-results", "playwright-report",
    "web-build", "static-build", "docs",
  ].includes(part))) return false;
  if (parts.some(part => part.startsWith(".env") || part === ".dev.vars")) return false;
  if (/\.(?:tsbuildinfo|log|db|sqlite|sqlite3|pem|key|p12|p8|mobileprovision|ipa|apk|aab|zip|tar|gz)$/i.test(file)) return false;
  // The launch snapshot has no PostgreSQL runtime or retired-provider tests.
  if (/postgres.*integration|places-postgres|account-library-postgres/i.test(file)) return false;
  return true;
}

export function prepareLaunchExport(directory = "generated-artifacts/oldtime-launch-source") {
  const destination = path.resolve(root, directory);
  if (!destination.startsWith(path.join(root, "generated-artifacts") + path.sep)) {
    throw new Error("Keep the review export inside the ignored generated-artifacts directory.");
  }
  const candidates = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root })
    .toString().split("\0").filter(Boolean);
  const files = [...new Set(candidates)].filter(includeLaunchSource).sort();
  const inventory = [];
  // Preflight all files before copying any. Never follow a symlink outside the
  // reviewed source tree or export a tracked credential by accident.
  for (const file of files) {
    const absolute = path.join(root, file);
    const info = lstatSync(absolute);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Non-regular source file: ${file}`);
    const bytes = readFileSync(absolute);
    const text = bytes.toString("utf8");
    const forbidden = [
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
      /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
      /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
      /\bAKIA[A-Z0-9]{16}\b/,
      /(?:postgres(?:ql)?|mysql):\/\/[^/\s:@]+:[^/\s@]+@/i,
    ];
    if (forbidden.some(pattern => pattern.test(text))) throw new Error(`Potential credential in ${file}; export stopped.`);
    inventory.push({ path: file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  // A fresh destination is intentional: do not silently retain files removed
  // from the allowlist after a previous review.
  try { lstatSync(destination); throw new Error("Export directory already exists; choose a fresh review directory before regenerating."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  for (const file of files) {
    const target = path.join(destination, file);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(root, file), target);
  }
  const readme = `# Oldtime launch source

Clean source snapshot for the private oldtimemessenger/Oldtime-launch repository.
The live app remains on Cloudflare Pages, Workers, D1 and R2. This snapshot
contains no production user records, secrets, reference uploads, generated
builds, or workspace Git history.

## Packages

- artifacts/oldtimehive: authoritative website and installable PWA.
- artifacts/api-server: existing API source; production entry is
  src/cloudflare/worker.ts, not the retired server routes.
- artifacts/oldtime-mobile: Expo iOS/Android wrapper, preserving the live UI.
- lib: required contracts, API clients, discovery and shared policy code.

## Local checks

Use Node.js 22+ and the pnpm version in package.json:

    pnpm install --frozen-lockfile
    pnpm --filter @workspace/oldtimehive run build
    pnpm --filter @workspace/api-server run typecheck
    pnpm --filter @workspace/oldtime-mobile run typecheck
    node --test artifacts/oldtime-mobile/test/*.test.mjs

Mobile preview and release limitations are in artifacts/oldtime-mobile/README.md.
PWA home-screen installation is separate from Expo or app-store distribution.

## Cloudflare

Use the existing Wrangler configurations and account bindings. Supply secrets
through your provider's secret settings; never add them to source control.
Do not reset existing accounts or re-run historical destructive migrations.
Inspect the applied D1 migration journal before any future migration.
Production database migrations through 0034 have already been applied.

This repository does not enable automatic production deployment. Publishing,
store signing, and account permissions are separate actions.
`;
  writeFileSync(path.join(destination, "README.md"), readme);
  const review = {
    repository: "oldtimemessenger/Oldtime-launch",
    branch: "main",
    directory: path.relative(root, destination),
    fileCount: inventory.length + 1,
    sourceBytes: inventory.reduce((sum, file) => sum + file.bytes, 0) + Buffer.byteLength(readme),
    files: inventory,
    generatedReadmeSha256: createHash("sha256").update(readme).digest("hex"),
  };
  writeFileSync(path.join(root, "generated-artifacts/oldtime-launch-review.json"), JSON.stringify(review, null, 2));
  return { ...review, files: undefined };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(prepareLaunchExport(process.argv[2]), null, 2));
}

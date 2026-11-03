import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function buildCloudflarePages() {
  const result = spawnSync(
    "pnpm",
    ["--filter", "@workspace/oldtimehive", "run", "build"],
    {
      cwd: workspaceRoot,
      env: process.env,
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw new Error(`Could not start the Oldtime Pages build: ${result.error.message}`);
  }
  return result.status ?? 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = buildCloudflarePages();
  } catch (error) {
    console.error(
      `[cloudflare-pages] ${error instanceof Error ? error.message : "Build configuration is invalid."}`,
    );
    process.exitCode = 1;
  }
}

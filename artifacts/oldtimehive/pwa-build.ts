import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";

type BuildChunk = {
  type: "chunk";
  fileName: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  viteMetadata?: { importedCss?: Iterable<string> };
};

type BuildAsset = {
  type: "asset";
  fileName: string;
  source: string | Uint8Array;
};

type BuildOutput = Record<string, BuildChunk | BuildAsset>;

export function collectStartupAssets(bundle: BuildOutput): string[] {
  const entryChunks = Object.values(bundle).filter((output): output is BuildChunk =>
    output.type === "chunk" && output.isEntry === true,
  );
  if (!entryChunks.length) {
    throw new Error("The production entry script could not be found in the build.");
  }

  const files = new Set<string>();
  const visited = new Set<string>();
  const visitStaticDependencies = (fileName: string) => {
    if (visited.has(fileName)) return;
    visited.add(fileName);
    const chunk = bundle[fileName];
    if (!chunk || chunk.type !== "chunk") return;
    files.add(chunk.fileName);
    for (const stylesheet of chunk.viteMetadata?.importedCss ?? []) {
      files.add(stylesheet);
    }
    for (const imported of chunk.imports ?? []) {
      visitStaticDependencies(imported);
    }
  };

  for (const entry of entryChunks) {
    visitStaticDependencies(entry.fileName);
    // The release entry intentionally waits for Cloudflare health and the
    // one-time fresh-start check before dynamically importing the app shell.
    // Include that first level for reliable offline startup, but leave feature
    // chunks imported by the app to load only when their feature is opened.
    for (const startupImport of entry.dynamicImports ?? []) {
      visitStaticDependencies(startupImport);
    }
  }

  return [...files];
}

// Keep install assets at stable, scope-relative URLs and precache the actual
// startup dependency graph, never development /app/*.js paths or unused
// feature chunks.
export function oldtimePwa(): Plugin {
  let base = "/";
  return {
    name: "oldtime-production-pwa",
    apply: "build",
    configResolved(config) { base = config.base; },
    transformIndexHtml: {
      order: "post",
      handler(html) {
        // Vite otherwise hashes the manifest under /assets/, which changes
        // how its relative start URL, scope and icon URLs resolve.
        return html.replace(/<link rel="manifest" href="[^"]*"\s*\/?>/,
          `<link rel="manifest" href="${base}manifest.json" />`);
      },
    },
    async generateBundle(_options, bundle) {
      const root = new URL("./", import.meta.url);
      const digest = createHash("sha256");
      const stableFiles = ["manifest.json", "app-icon.svg", "app-icon-180.png", "app-icon-192.png", "app-icon-512.png"];
      const stablePublicFiles = ["brand/oldtime-feather.png", "brand/oldtime-app-icon.png"];
      for (const file of stableFiles) {
        const source = await readFile(new URL(file, root));
        digest.update(source);
        this.emitFile({ type: "asset", fileName: file, source });
      }
      for (const file of stablePublicFiles) {
        digest.update(await readFile(new URL(`public/${file}`, root)));
      }
      const files = [...new Set([
        "index.html",
        ...stableFiles,
        ...stablePublicFiles,
        ...collectStartupAssets(bundle as BuildOutput),
      ])];
      const template = await readFile(new URL("service-worker.js", root), "utf8");
      const version = digest.update(JSON.stringify(files)).update(template).digest("hex").slice(0, 16);
      this.emitFile({ type: "asset", fileName: "service-worker.js", source: template
        .replace('"__BUILD_VERSION__"', JSON.stringify(version))
        .replace('["__PRECACHE_FILES__"]', JSON.stringify(files.map(name => `./${name}`))) });
    },
  };
}

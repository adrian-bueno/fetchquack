#!/usr/bin/env bun
import { readFile, writeFile, rm, mkdir, cp } from "fs/promises";
import { join, resolve } from "path";
import { build, BuildOptions } from 'bunup';
import * as esbuild from 'esbuild';
import { ngPackagr } from 'ng-packagr';

const ROOT_DIR = join(import.meta.dir, "..");
const DIST_DIR = join(ROOT_DIR, "dist");

// Interceptor names for dynamic configuration
const INTERCEPTORS = ['auth', 'csrf', 'header', 'logging'] as const;

// Fields to exclude from the published package.json
const PACKAGEJSON_EXCLUDED_FIELDS = [
  "private",
  "workspaces",
  "scripts",
  "devDependencies",
  "overrides",
  "resolutions"
];

// Generate interceptor exports dynamically
const interceptorExports = Object.fromEntries(
  INTERCEPTORS.map(name => [
    `./interceptors/${name}`,
    {
      import: {
        types: `./interceptors/${name}/${name}-interceptor.d.ts`,
        default: `./interceptors/${name}/${name}-interceptor.js`
      },
      require: {
        types: `./interceptors/${name}/${name}-interceptor.d.cts`,
        default: `./interceptors/${name}/${name}-interceptor.cjs`
      }
    }
  ])
);

const PACKAGEJSON_INCLUDED_FIELDS = {
  sideEffects: false,
  exports: {
    ".": {
      bun: {
        types: "./server/index.d.ts",
        import: "./server/index.js",
        default: "./server/index.js"
      },
      deno: {
        types: "./server/index.d.ts",
        import: "./server/index.js",
        default: "./server/index.js"
      },
      node: {
        import: {
          types: "./server/index.d.ts",
          default: "./server/index.js"
        },
        require: {
          types: "./server/index.d.cts",
          default: "./server/index.cjs"
        }
      },
      browser: {
        types: "./browser/index.d.ts",
        import: "./browser/index.js",
        default: "./browser/index.js"
      },
      default: {
        types: "./browser/index.d.ts",
        import: "./browser/index.js",
        default: "./browser/index.js"
      }
    },
    ...interceptorExports,
    "./ngx": {
      types: "./ngx/index.d.ts",
      default: "./ngx/fesm2022/ngx.mjs"
    },
    "./package.json": {
      default: "./package.json"
    }
  },
};

// Generate interceptor build options dynamically
const interceptorBuildOptions: BuildOptions[] = INTERCEPTORS.map(name => ({
  name: `interceptors/${name}`,
  entry: `src/interceptors/${name}-interceptor.ts`,
  target: 'node',
  format: ['esm', 'cjs'],
  outDir: `dist/interceptors/${name}`,
  dts: true,
  sourcemap: "external"
}));

const bunupOptions: BuildOptions[] = [
  {
    name: 'browser',
    entry: 'src/browser/index.ts',
    target: 'browser',
    format: 'esm',
    outDir: 'dist/browser',
    dts: true,
    minify: true,
    sourcemap: "external"
  },
  {
    name: 'server',
    entry: 'src/server/index.ts',
    target: 'node',
    format: ['esm', 'cjs'],
    outDir: 'dist/server',
    dts: true,
    sourcemap: "external"
  },
  ...interceptorBuildOptions
];

async function main() {
  console.log("🧹 Cleaning dist directory...");
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  console.log("🚀 Starting build pipeline...");

  // Build all bunup targets
  for (const option of bunupOptions) {
    console.log(`🔨 Building ${option.name}...`);
    await build(option);
  }

  // Build browser IIFE with esbuild
  console.log("🔨 Building browser IIFE...");
  await esbuild.build({
    entryPoints: ['src/browser/index.ts'],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    outfile: 'dist/browser/index.iife.js',
    minify: true,
    sourcemap: 'external',
    globalName: 'FetchStreamSSE',
  });

  // Build Angular package
  console.log("🔨 Building ngx...");
  await ngPackagr()
    .forProject(resolve(__dirname, '../ngx/ng-package.json'))
    .withTsConfig(resolve(__dirname, '../ngx/tsconfig.build.json'))
    .build();

  console.log("✅ Build finished successfully!");

  // Clean up unnecessary Angular-generated files
  console.log("🗑️  Cleaning up ngx artifacts...");
  await Promise.all([
    rm(join(DIST_DIR, "ngx/package.json"), { force: true }),
    rm(join(DIST_DIR, "ngx/.npmignore"), { force: true }),
    rm(join(DIST_DIR, "ngx/README.md"), { force: true }),
  ]);

  // Generate dist/package.json
  console.log("📝 Generating dist/package.json...");
  const rootPkg = JSON.parse(await readFile(join(ROOT_DIR, "package.json"), "utf-8"));

  const distPkg = Object.fromEntries(
    Object.entries(rootPkg).filter(([key]) => !PACKAGEJSON_EXCLUDED_FIELDS.includes(key))
  );
  Object.assign(distPkg, PACKAGEJSON_INCLUDED_FIELDS);

  await writeFile(join(DIST_DIR, "package.json"), JSON.stringify(distPkg, null, 2));

  // Copy README and LICENSE
  console.log("📄 Copying README.md and LICENSE.md...");
  await Promise.all([
    cp(join(ROOT_DIR, "README.md"), join(DIST_DIR, "README.md")),
    cp(join(ROOT_DIR, "LICENSE.md"), join(DIST_DIR, "LICENSE.md")),
    cp(join(ROOT_DIR, "readme-header.webp"), join(DIST_DIR, "readme-header.webp")),
    cp(join(ROOT_DIR, "README-tests.md"), join(DIST_DIR, "README-tests.md")),
  ]);

  console.log("✅ Build complete! Output in dist/");
}

main().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});

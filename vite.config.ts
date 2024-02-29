import { defineConfig } from "vite";
import { mkdirSync, existsSync, writeFileSync } from "fs";

import typescript from "@rollup/plugin-typescript";
import path from "path";
import { typescriptPaths } from "rollup-plugin-typescript-paths";
import packageJson from "./package.json";

// creating entries from exports section of package.json
const entries = {};

Object.entries(packageJson.exports).forEach(([key, settings]) => {
  if (key !== ".") {
    // remove ./
    const entryName = key.replace(/^\.\//, "");
    const dir = path.resolve(__dirname, entryName);
    if (!existsSync(dir)) {
      mkdirSync(dir);
    }
    writeFileSync(
      path.resolve(dir, "package.json"),
      JSON.stringify({
        main: "." + settings.import,
        typings: "." + settings.typings,
      }),
      "utf-8"
    );
  }

  // main export
  if (key === ".") {
    entries["index"] = "src/index.ts";
    return;
  }

  // other export
  if (key.startsWith("./")) {
    const name = key.substring(2);
    entries[name + "/index"] = `src/${name}/index.ts`;
    return;
  }

  // unsupported export
  throw new Error(
    `Unsupported export ${key}: ${JSON.stringify(packageJson.exports[key])}`
  );
});

const replaceRootPathResolver = {
  find: "~",
  replacement: path.resolve(__dirname, "./src"),
};

export default defineConfig({
  plugins: [],
  resolve: {
    alias: [replaceRootPathResolver],
  },
  build: {
    manifest: true,
    minify: false,
    reportCompressedSize: true,
    lib: {
      entry: entries,
      formats: ["es"],
    },
    rollupOptions: {
      external: ["react", "react-dom", "@wry/equality"],
      plugins: [
        typescriptPaths({
          preserveExtensions: true,
        }),
        typescript({
          sourceMap: false,
          declaration: true,
          exclude: ["**/*.spec.*", "./dist/**/*"],
          outDir: "dist",
        }),
      ],
    },
  },
});

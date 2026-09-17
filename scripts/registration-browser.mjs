/* eslint-env node */
// Isolated development harness. Never imported by the application or deployed.
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const workspace = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const server = await createServer({
  configFile: false,
  root: path.join(workspace, "tests/browser"),
  cacheDir: path.join(workspace, "node_modules/.cache/registration-browser"),
  esbuild: { jsx: "automatic" },
  server: {
    host: "127.0.0.1",
    port: 4317,
    strictPort: true,
    fs: { allow: [workspace] },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client", "react-router", "@dnd-kit/core"],
  },
});
await server.listen();
console.log("Registration development harness: http://127.0.0.1:4317/builder");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
}

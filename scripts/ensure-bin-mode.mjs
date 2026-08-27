import { chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  chmodSync(fileURLToPath(new URL("../dist/diagnose.js", import.meta.url)), 0o755);
}

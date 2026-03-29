import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeWasm } from "./utils.js";

const cwd = dirname(fileURLToPath(import.meta.url));
const wasmFile = join(cwd, "canvaskit.wasm");

export async function create() {
	return initializeWasm({ wasmFile });
}

export { initializeWasm };

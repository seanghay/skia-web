import { initializeWasm } from "./utils.js";

const wasmFile = new URL("./canvaskit.wasm", import.meta.url).href;

export async function create({ fonts = [] } = {}) {
	return initializeWasm({
		wasmFile,
		fonts,
	});
}

export { initializeWasm };
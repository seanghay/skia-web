import type { CanvasKit } from "./canvaskit";

export declare function create(): Promise<CanvasKit>;

export declare function initializeWasm({
	wasmFile,
}: { wasmFile: string }): Promise<CanvasKit>;

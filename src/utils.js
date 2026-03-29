import initialize from './canvaskit.js';

export async function initializeWasm({ wasmFile }) {
  return initialize({ 
    locateFile: () => wasmFile
  })
}
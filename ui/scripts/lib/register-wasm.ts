import fs from "node:fs";
import Module from "node:module";

/**
 * Teaches the CommonJS loader (used by tsx) to load WebAssembly modules,
 * which the @cooklang/cooklang parser imports via ESM WASM integration.
 * Import this module before anything that pulls in the recipe domain.
 */

type ModuleWithExtensions = typeof Module & {
  _extensions: Record<string, (mod: NodeJS.Module, filename: string) => void>;
};

(Module as ModuleWithExtensions)._extensions[".wasm"] = (mod, filename) => {
  const wasmModule = new WebAssembly.Module(fs.readFileSync(filename));
  const imports: WebAssembly.Imports = {};
  for (const descriptor of WebAssembly.Module.imports(wasmModule)) {
    imports[descriptor.module] ??= mod.require(descriptor.module);
  }
  mod.exports = new WebAssembly.Instance(wasmModule, imports).exports;
};

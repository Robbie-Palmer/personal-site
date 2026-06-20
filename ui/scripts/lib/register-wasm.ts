import fs from "node:fs";
import Module from "node:module";

/**
 * Teaches the CommonJS loader to load WebAssembly modules, which it would
 * otherwise try to parse as JavaScript. Import this before any module
 * whose dependency graph includes a .wasm file.
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

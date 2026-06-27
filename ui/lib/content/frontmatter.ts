import matter from "gray-matter";

/**
 * gray-matter selects its parser from an inline language fence (e.g. `---js`),
 * and its built-in `javascript` engine runs the front matter through `eval`.
 * For untrusted content (such as user-submitted recipes) that is remote code
 * execution. gray-matter merges supplied engines over its built-ins rather than
 * replacing them, so we override the `javascript` sink — the only eval-based
 * engine, and the target that every `js`/`javascript` alias resolves to — with
 * a stub that refuses to run. `coffee`/`cson` have no built-in engine and
 * already throw. YAML is parsed by js-yaml (forced to >=4.2.0 via a pnpm
 * override), whose `load` is safe by default and not subject to the merge-key
 * DoS in GHSA-h67p-54hq-rp68.
 *
 * All front-matter parsing in the app must go through this helper rather than
 * calling gray-matter directly.
 */
const refuseEval = (): never => {
  throw new Error("Refusing to evaluate JavaScript front matter");
};

export function parseFrontmatter(content: string) {
  return matter(content, {
    language: "yaml",
    engines: {
      javascript: refuseEval,
      js: refuseEval,
    },
  });
}

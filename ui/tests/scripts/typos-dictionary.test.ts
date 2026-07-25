import { describe, expect, it } from "vitest";
import { parseDictionaryTsv } from "@/lib/domain/recipe/typoDictionary";
import {
  applyExtendWords,
  parseExtendWords,
  parseTyposVersion,
  parseWordsCsv,
  serializeDictionary,
} from "@/scripts/lib/typos-dictionary";

describe("parseTyposVersion", () => {
  it("reads the pinned version from a .mise.toml", () => {
    expect(parseTyposVersion('foo = "1.0"\ntypos = "1.48.0"\n')).toBe("1.48.0");
  });

  it("throws when the version is missing", () => {
    expect(() => parseTyposVersion("biome = 2.0.0")).toThrow();
  });
});

describe("parseWordsCsv", () => {
  it("parses single and multi-correction rows, dropping trailing blanks", () => {
    const dict = parseWordsCsv("teh,the\naache,ache,cache\nfoo,\n\n");
    expect(dict.get("teh")).toEqual(["the"]);
    expect(dict.get("aache")).toEqual(["ache", "cache"]);
    expect(dict.get("foo")).toEqual([]);
    expect(dict.size).toBe(3);
  });
});

describe("parseExtendWords", () => {
  it("reads only the extend-words section, ignoring comments", () => {
    const toml = [
      "[default.extend-words]",
      'unparseable = "unparseable" # valid word',
      'colour = "color"',
      "",
      "[files]",
      'extend-exclude = ["foo"]',
    ].join("\n");
    const overrides = parseExtendWords(toml);
    expect(overrides.get("unparseable")).toBe("unparseable");
    expect(overrides.get("colour")).toBe("color");
    expect(overrides.has("extend-exclude")).toBe(false);
  });
});

describe("applyExtendWords", () => {
  it("removes allowlist self-maps and overrides real corrections", () => {
    const dict = parseWordsCsv(
      "unparseable,unparse able\ncolour,colour color\nteh,the",
    );
    applyExtendWords(
      dict,
      new Map([
        ["unparseable", "unparseable"],
        ["colour", "color"],
      ]),
    );
    expect(dict.has("unparseable")).toBe(false);
    expect(dict.get("colour")).toEqual(["color"]);
    expect(dict.get("teh")).toEqual(["the"]);
  });
});

describe("serializeDictionary", () => {
  it("emits sorted TSV that round-trips through parseDictionaryTsv", () => {
    const dict = parseWordsCsv("teh,the\naache,ache,cache");
    const tsv = serializeDictionary(dict);
    expect(tsv).toBe("aache\tache,cache\nteh\tthe\n");
    expect(parseDictionaryTsv(tsv)).toEqual(dict);
  });
});

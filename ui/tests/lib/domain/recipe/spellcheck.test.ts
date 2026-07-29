import { describe, expect, it } from "vitest";
import {
  applyCorrection,
  findMisspellings,
  tokenizeWords,
} from "@/lib/domain/recipe/spellcheck";

const DICT = new Map<string, string[]>([
  ["teh", ["the"]],
  ["tomatoe", ["tomato"]],
  ["recieve", ["receive"]],
  ["seperate", ["separate", "desperate"]],
  ["definately", ["definitely"]],
]);

describe("tokenizeWords", () => {
  it("skips Cooklang syntax, digits and units, keeping word offsets", () => {
    const tokens = tokenizeWords("@tomatoe{200%g}");
    expect(tokens).toEqual([
      { word: "tomatoe", start: 1, end: 8 },
      { word: "g", start: 13, end: 14 },
    ]);
  });

  it("splits camelCase and PascalCase into sub-words", () => {
    expect(tokenizeWords("recieveMessage").map((t) => t.word)).toEqual([
      "recieve",
      "Message",
    ]);
    expect(tokenizeWords("XMLHttpRequest").map((t) => t.word)).toEqual([
      "XML",
      "Http",
      "Request",
    ]);
  });

  it("trims edge apostrophes but keeps interior ones", () => {
    expect(tokenizeWords("don't fish'").map((t) => t.word)).toEqual([
      "don't",
      "fish",
    ]);
  });
});

describe("findMisspellings", () => {
  it("flags a known typo with its offset and suggestion", () => {
    expect(findMisspellings("teh cat", DICT)).toEqual([
      { start: 0, end: 3, word: "teh", suggestions: ["the"] },
    ]);
  });

  it("finds typos inside Cooklang ingredient names", () => {
    const [issue] = findMisspellings("Add @tomatoe{2}", DICT);
    expect(issue).toMatchObject({ start: 5, end: 12, word: "tomatoe" });
  });

  it("preserves the original casing in suggestions", () => {
    expect(findMisspellings("Teh", DICT)[0]?.suggestions).toEqual(["The"]);
    expect(findMisspellings("TEH", DICT)[0]?.suggestions).toEqual(["THE"]);
    expect(findMisspellings("teh", DICT)[0]?.suggestions).toEqual(["the"]);
  });

  it("deduplicates cased suggestions and keeps multiples", () => {
    expect(findMisspellings("seperate", DICT)[0]?.suggestions).toEqual([
      "separate",
      "desperate",
    ]);
  });

  it("skips ignored words (case-insensitive)", () => {
    expect(findMisspellings("Teh teh", DICT, new Set(["teh"]))).toEqual([]);
  });

  it("does not flag correctly spelled words", () => {
    expect(findMisspellings("the ripe tomato", DICT)).toEqual([]);
  });
});

describe("applyCorrection", () => {
  it("replaces only the flagged range", () => {
    const [issue] = findMisspellings("cook teh onion", DICT);
    expect(issue && applyCorrection("cook teh onion", issue, "the")).toBe(
      "cook the onion",
    );
  });
});

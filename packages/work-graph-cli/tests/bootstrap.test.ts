import { describe, expect, it } from "vitest";
import {
  DOPPLER_BOOTSTRAP_MARKER,
  dopplerBootstrapArgs,
} from "../src/bootstrap.js";

describe("Given Work Graph CLI startup", () => {
  it("wraps API commands with the fixed production Doppler config", () => {
    expect(
      dopplerBootstrapArgs(["ready", "--limit", "5"], {}, "/node", "/cli.js"),
    ).toEqual([
      "run",
      "--project",
      "work-graph",
      "--config",
      "prd_work_graph",
      "--",
      "/node",
      "/cli.js",
      "ready",
      "--limit",
      "5",
    ]);
  });

  it.each([
    ["offline help", ["--help"], {}],
    ["offline prime", ["prime"], {}],
    [
      "configured environment",
      ["ready"],
      { WORK_GRAPH_API_URL: "https://work.test" },
    ],
    ["explicit API URL", ["--api-url", "http://localhost:8787", "ready"], {}],
    ["recursive child", ["ready"], { [DOPPLER_BOOTSTRAP_MARKER]: "1" }],
  ])("does not bootstrap %s", (_label, args, environment) => {
    expect(
      dopplerBootstrapArgs(args, environment, "/node", "/cli.js"),
    ).toBeUndefined();
  });
});

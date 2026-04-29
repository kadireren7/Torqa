import { describe, expect, it } from "vitest";
import { filterScanPaths } from "@/lib/github-pr/filter-scan-paths";

describe("filterScanPaths", () => {
  it("keeps .tq and .json outside noise dirs", () => {
    expect(
      filterScanPaths([
        "src/flow.tq",
        "workflows/n8n.json",
        "node_modules/x.json",
        "README.md",
        "package-lock.json",
      ])
    ).toEqual(["src/flow.tq", "workflows/n8n.json"]);
  });

  it("dedupes paths", () => {
    expect(filterScanPaths(["a.tq", "a.tq"])).toEqual(["a.tq"]);
  });
});

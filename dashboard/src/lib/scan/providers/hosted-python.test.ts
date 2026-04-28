import { afterEach, describe, expect, it, vi } from "vitest";
import { hostedPythonProvider } from "@/lib/scan/providers/hosted-python";
import { ScanProviderExecutionError } from "@/lib/scan/providers/types";

describe("hostedPythonProvider fallback policy", () => {
  afterEach(() => {
    delete process.env.TORQA_ENGINE_URL;
    delete process.env.TORQA_ALLOW_PREVIEW_FALLBACK;
    vi.unstubAllGlobals();
  });

  it("returns fallback preview metadata when fallback is enabled", async () => {
    process.env.TORQA_ALLOW_PREVIEW_FALLBACK = "true";
    const result = await hostedPythonProvider.scan({ source: "n8n", content: { nodes: [], connections: {} } });
    expect(result.engine_mode).toBe("fallback_preview");
    expect(result.fallback.fallback_used).toBe(true);
    expect(result.analysis_kind).toBe("preview_heuristic");
  });

  it("throws when hosted engine is missing and fallback is disabled", async () => {
    process.env.TORQA_ALLOW_PREVIEW_FALLBACK = "false";
    await expect(
      hostedPythonProvider.scan({ source: "generic", content: { hello: "world" } })
    ).rejects.toBeInstanceOf(ScanProviderExecutionError);
  });

  it("throws when hosted engine call fails and fallback is disabled", async () => {
    process.env.TORQA_ENGINE_URL = "https://torqa.invalid";
    process.env.TORQA_ALLOW_PREVIEW_FALLBACK = "false";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(
      hostedPythonProvider.scan({ source: "generic", content: { ok: true } })
    ).rejects.toBeInstanceOf(ScanProviderExecutionError);
  });
});

import { describe, expect, it } from "vitest";
import { wrapPublicError, wrapPublicSuccess } from "@/lib/public-api-envelope";

describe("public API envelope helpers", () => {
  it("wraps success payload with ok/data/meta", () => {
    const out = wrapPublicSuccess({ status: "PASS" }, "req_123");
    expect(out.ok).toBe(true);
    expect(out.data).toEqual({ status: "PASS" });
    expect(out.meta.requestId).toBe("req_123");
  });

  it("wraps error payload with stable shape", () => {
    const out = wrapPublicError("bad_request", "Invalid body", "req_1");
    expect(out.ok).toBe(false);
    expect(out.error.code).toBe("bad_request");
    expect(out.error.message).toBe("Invalid body");
    expect(out.meta.requestId).toBe("req_1");
  });
});

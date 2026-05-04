import { describe, expect, it } from "vitest";
import { detectSource, getSourceEntry, listSourceIds } from "./source-registry";
import { analyzeMake, isLikelyMake } from "./adapters/make";
import { analyzeZapier, isLikelyZapier } from "./adapters/zapier";
import { analyzeLambda, isLikelyLambda } from "./adapters/lambda";

describe("source-registry", () => {
  it("listSourceIds includes the v0.2.1 additions", () => {
    const ids = listSourceIds();
    expect(ids).toContain("make");
    expect(ids).toContain("zapier");
    expect(ids).toContain("lambda");
  });

  it("getSourceEntry returns null for unknown id", () => {
    // @ts-expect-error: feeding bad id intentionally to test the guard
    expect(getSourceEntry("does-not-exist")).toBeNull();
  });

  it("detects Make.com scenarios with high confidence", () => {
    const r = detectSource({
      name: "x",
      flow: [{ id: 1, module: "http:ActionSendData", mapper: { url: "https://example" } }],
      metadata: { instant: true },
    });
    expect(r.source).toBe("make");
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it("detects Zapier zaps", () => {
    const r = detectSource({
      zap: { id: "1", title: "x" },
      steps: [{ id: "a", type_of: "trigger", selected_api: "WebhookV2", params: {} }],
    });
    expect(r.source).toBe("zapier");
  });

  it("detects Lambda CloudFormation templates", () => {
    const r = detectSource({
      AWSTemplateFormatVersion: "2010-09-09",
      Resources: {
        F: { Type: "AWS::Lambda::Function", Properties: { FunctionName: "x", Runtime: "python3.11" } },
      },
    });
    expect(r.source).toBe("lambda");
  });

  it("falls back to generic when nothing matches", () => {
    const r = detectSource({ foo: "bar" });
    expect(r.source).toBe("generic");
  });

  it("prefers n8n over generic when both could match", () => {
    const r = detectSource({
      nodes: [{ id: "1", name: "Webhook", type: "n8n-nodes-base.webhook", parameters: {} }],
      connections: { Webhook: {} },
    });
    expect(r.source).toBe("n8n");
  });
});

describe("adapter: Make.com", () => {
  it("flags plaintext bearer tokens in mapper", () => {
    const findings = analyzeMake({
      flow: [
        {
          id: 1,
          module: "http:ActionSendData",
          mapper: {
            url: "http://api.example.com/x",
            headers: [{ name: "Authorization", value: "Bearer real-token-12345" }],
            rejectUnauthorized: false,
          },
        },
      ],
    });
    const codes = findings.map((f) => f.rule_id);
    expect(codes).toContain("v1.secret.plaintext_detected");
    expect(codes).toContain("v1.http.plaintext_transport");
    expect(codes).toContain("v1.http.tls_verification_disabled");
  });

  it("flags webhook listener without auth", () => {
    const findings = analyzeMake({
      flow: [
        {
          id: 2,
          module: "gateway:CustomWebHook",
          mapper: { hook: "https://hook.eu1.make.com/abc" },
        },
      ],
    });
    expect(findings.some((f) => f.rule_id === "v1.webhook.public_no_auth")).toBe(true);
  });

  it("isLikelyMake returns false for n8n shape", () => {
    expect(isLikelyMake({ nodes: [{}], connections: {} })).toBe(false);
  });

  it("emits shape_mismatch for invalid input", () => {
    const findings = analyzeMake({ wrong: "shape" });
    expect(findings.some((f) => f.rule_id === "v1.make.shape_mismatch")).toBe(true);
  });
});

describe("adapter: Zapier", () => {
  it("flags catch-hook step without auth", () => {
    const findings = analyzeZapier({
      zap: { id: "1", title: "x" },
      steps: [
        { id: "trg", type_of: "trigger", selected_api: "WebhookV2", params: { url: "https://x" } },
      ],
    });
    expect(findings.some((f) => f.rule_id === "v1.webhook.public_no_auth")).toBe(true);
  });

  it("flags HTTP step using plaintext URL", () => {
    const findings = analyzeZapier({
      zap: { id: "1", title: "x" },
      steps: [
        {
          id: "act",
          type_of: "action",
          selected_api: "HTTPRequest",
          params: { url: "http://internal.example.com" },
        },
      ],
    });
    expect(findings.some((f) => f.rule_id === "v1.http.plaintext_transport")).toBe(true);
  });

  it("flags continue_on_error", () => {
    const findings = analyzeZapier({
      zap: { id: "1", title: "x" },
      steps: [
        {
          id: "act",
          type_of: "action",
          selected_api: "SlackAPI",
          params: { continue_on_error: true },
        },
      ],
    });
    expect(findings.some((f) => f.rule_id === "v1.zapier.swallow_errors")).toBe(true);
  });

  it("isLikelyZapier returns false for empty object", () => {
    expect(isLikelyZapier({})).toBe(false);
  });
});

describe("adapter: AWS Lambda", () => {
  it("flags deprecated runtime + over-permissioned role + plaintext env secret", () => {
    const findings = analyzeLambda({
      Resources: {
        F: {
          Type: "AWS::Serverless::Function",
          Properties: {
            FunctionName: "x",
            Runtime: "python3.7",
            Handler: "h",
            Timeout: 120,
            Role: "arn:aws:iam::1:role/AdministratorAccess",
            Environment: { Variables: { STRIPE_API_KEY: "sk_live_realtoken" } },
          },
        },
      },
    });
    const codes = findings.map((f) => f.rule_id);
    expect(codes).toContain("v1.lambda.deprecated_runtime");
    expect(codes).toContain("v1.lambda.over_permissioned_role");
    expect(codes).toContain("v1.lambda.long_timeout");
    expect(codes).toContain("v1.secret.plaintext_detected");
  });

  it("emits no_functions when input has no Lambda definitions", () => {
    const findings = analyzeLambda({ AWSTemplateFormatVersion: "2010-09-09", Resources: {} });
    expect(findings.some((f) => f.rule_id === "v1.lambda.no_functions")).toBe(true);
  });

  it("isLikelyLambda accepts get-function shape", () => {
    expect(isLikelyLambda({ FunctionName: "x", Runtime: "nodejs20.x" })).toBe(true);
  });
});

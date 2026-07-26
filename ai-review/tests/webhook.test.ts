import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseReviewEvent, verifyGitHubSignature } from "../src/webhook";

describe("verifyGitHubSignature", () => {
  it("accepts a valid sha256 signature", async () => {
    const body = '{"zen":"Keep it logically awesome."}';
    const secret = "test-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

    await expect(
      verifyGitHubSignature(body, signature, secret),
    ).resolves.toBe(true);
  });

  it("rejects a mismatched signature", async () => {
    await expect(
      verifyGitHubSignature("body", "sha256=deadbeef", "secret"),
    ).resolves.toBe(false);
  });

  it("rejects missing and malformed signature headers", async () => {
    await expect(
      verifyGitHubSignature("body", null, "secret"),
    ).resolves.toBe(false);
    await expect(
      verifyGitHubSignature("body", "sha1=deadbeef", "secret"),
    ).resolves.toBe(false);
  });
});

describe("parseReviewEvent", () => {
  it("extracts the pull request identity without retaining the payload", () => {
    expect(
      parseReviewEvent("pull_request", "delivery-1", {
        action: "synchronize",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        pull_request: { number: 816, head: { sha: "abc123" } },
      }),
    ).toEqual({
      deliveryId: "delivery-1",
      eventName: "pull_request",
      action: "synchronize",
      repository: "Robbie-Palmer/personal-site",
      pullRequestNumber: 816,
      headSha: "abc123",
    });
  });

  it("ignores issue comments that are not on pull requests", () => {
    expect(
      parseReviewEvent("issue_comment", "delivery-2", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        issue: { number: 1 },
      }),
    ).toBeNull();
  });

  it("ignores pull request actions that do not warrant a review", () => {
    expect(
      parseReviewEvent("pull_request", "delivery-ignored", {
        action: "labeled",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        pull_request: { number: 816, head: { sha: "abc123" } },
      }),
    ).toBeNull();
  });

  it("rejects malformed webhook envelopes", () => {
    expect(parseReviewEvent("pull_request", "", null)).toBeNull();
    expect(
      parseReviewEvent("pull_request", "", {
        action: "opened",
        repository: { full_name: "Robbie-Palmer/personal-site" },
      }),
    ).toBeNull();
    expect(
      parseReviewEvent("pull_request", "delivery", {
        action: "opened",
        repository: { full_name: "Robbie-Palmer/personal-site" },
      }),
    ).toBeNull();
    expect(
      parseReviewEvent("unsupported", "delivery", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
      }),
    ).toBeNull();
  });

  it("extracts pull request issue comments", () => {
    expect(
      parseReviewEvent("issue_comment", "delivery-comment", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        issue: { number: 816, pull_request: {} },
      }),
    ).toMatchObject({
      eventName: "issue_comment",
      pullRequestNumber: 816,
    });
  });

  it("extracts pull request review thread events", () => {
    expect(
      parseReviewEvent("pull_request_review_thread", "delivery-3", {
        action: "resolved",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        pull_request: { number: 816 },
      }),
    ).toMatchObject({
      eventName: "pull_request_review_thread",
      action: "resolved",
      pullRequestNumber: 816,
    });
  });
});

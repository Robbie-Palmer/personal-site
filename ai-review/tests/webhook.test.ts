import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseFindingInteraction,
  parseReviewEvent,
  verifyGitHubSignature,
} from "../src/webhook";

describe("verifyGitHubSignature", () => {
  it("accepts a valid sha256 signature", async () => {
    const body = '{"zen":"Keep it logically awesome."}';
    const secret = "test-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

    await expect(verifyGitHubSignature(body, signature, secret)).resolves.toBe(
      true,
    );
  });

  it("rejects a mismatched signature", async () => {
    await expect(
      verifyGitHubSignature("body", "sha256=deadbeef", "secret"),
    ).resolves.toBe(false);
    await expect(
      verifyGitHubSignature("body", `sha256=${"0".repeat(64)}`, "secret"),
    ).resolves.toBe(false);
  });

  it("rejects missing and malformed signature headers", async () => {
    await expect(verifyGitHubSignature("body", null, "secret")).resolves.toBe(
      false,
    );
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
      kind: "accepted",
      event: {
        deliveryId: "delivery-1",
        eventName: "pull_request",
        action: "synchronize",
        repository: "Robbie-Palmer/personal-site",
        pullRequestNumber: 816,
        headSha: "abc123",
        force: false,
      },
    });
  });

  it("ignores issue comments that are not on pull requests", () => {
    expect(
      parseReviewEvent("issue_comment", "delivery-2", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        issue: { number: 1 },
      }),
    ).toEqual({ kind: "ignored", reason: "unsupported-event" });
    expect(
      parseReviewEvent("issue_comment", "delivery-2", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        issue: { number: 1, pull_request: true },
        sender: { login: "robbie" },
        comment: {
          body: "/ai-review",
          author_association: "OWNER",
          user: { login: "robbie" },
        },
      }),
    ).toEqual({ kind: "invalid", reason: "Malformed webhook payload" });
  });

  it("ignores pull request actions that do not warrant a review", () => {
    expect(
      parseReviewEvent("pull_request", "delivery-ignored", {
        action: "labeled",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        pull_request: { number: 816, head: { sha: "abc123" } },
      }),
    ).toEqual({ kind: "ignored", reason: "unsupported-event" });
  });

  it("requires a non-empty head SHA for pull request events", () => {
    for (const sha of [undefined, ""]) {
      expect(
        parseReviewEvent("pull_request", "delivery-missing-sha", {
          action: "synchronize",
          repository: { full_name: "Robbie-Palmer/personal-site" },
          pull_request: { number: 816, head: { sha } },
        }),
      ).toEqual({ kind: "invalid", reason: "Malformed webhook payload" });
    }
  });

  it("rejects malformed webhook envelopes", () => {
    expect(parseReviewEvent("pull_request", "", null)).toEqual({
      kind: "invalid",
      reason: "Malformed webhook payload",
    });
    expect(
      parseReviewEvent("pull_request", "", {
        action: "opened",
        repository: { full_name: "Robbie-Palmer/personal-site" },
      }),
    ).toEqual({ kind: "invalid", reason: "Malformed webhook payload" });
    expect(
      parseReviewEvent("pull_request", "delivery", {
        action: "opened",
        repository: { full_name: "Robbie-Palmer/personal-site" },
      }),
    ).toEqual({ kind: "invalid", reason: "Malformed webhook payload" });
    expect(
      parseReviewEvent("unsupported", "delivery", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
      }),
    ).toEqual({ kind: "ignored", reason: "unsupported-event" });
    expect(parseReviewEvent("pull_request", "delivery", [])).toEqual({
      kind: "invalid",
      reason: "Malformed webhook payload",
    });
    expect(
      parseReviewEvent("pull_request_review", "delivery", {
        action: "submitted",
        repository: { full_name: "Robbie-Palmer/personal-site" },
      }),
    ).toEqual({ kind: "ignored", reason: "unsupported-event" });
  });

  it("extracts pull request issue comments", () => {
    expect(
      parseReviewEvent("issue_comment", "delivery-comment", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        issue: { number: 816, pull_request: {} },
        sender: { login: "robbie" },
        comment: {
          body: "/ai-review",
          author_association: "OWNER",
          user: { login: "robbie" },
        },
      }),
    ).toEqual({
      kind: "accepted",
      event: expect.objectContaining({
        eventName: "issue_comment",
        pullRequestNumber: 816,
        force: true,
      }),
    });
  });

  it("does not spend on review-thread activity", () => {
    expect(
      parseReviewEvent("pull_request_review_thread", "delivery-3", {
        action: "resolved",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        pull_request: { number: 816 },
      }),
    ).toEqual({ kind: "ignored", reason: "unsupported-event" });
  });

  it("ignores ordinary and untrusted issue comments", () => {
    for (const comment of [
      { body: "looks good", author_association: "OWNER" },
      { body: " /ai-review\n", author_association: "OWNER" },
      { body: "/ai-review", author_association: "NONE" },
    ]) {
      expect(
        parseReviewEvent("issue_comment", "delivery-comment", {
          action: "created",
          repository: { full_name: "Robbie-Palmer/personal-site" },
          issue: { number: 816, pull_request: {} },
          comment,
        }),
      ).toEqual({ kind: "ignored", reason: "unsupported-event" });
    }
  });
});

describe("parseFindingInteraction", () => {
  it("accepts explicit dispositions from trusted pull request commenters", () => {
    expect(
      parseFindingInteraction("issue_comment", "feedback-1", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        issue: { number: 816, pull_request: {} },
        sender: { login: "robbie" },
        comment: {
          id: 99,
          body: `/ai-review reject f_${"a".repeat(24)} false positive`,
          author_association: "OWNER",
          user: { login: "robbie" },
          created_at: "2026-08-09T12:00:00Z",
        },
      }),
    ).toEqual({
      kind: "accepted",
      event: expect.objectContaining({
        interactionType: "disposition",
        disposition: "rejected",
        findingId: `f_${"a".repeat(24)}`,
        reason: "false positive",
      }),
    });
  });

  it("rejects feedback from untrusted actors", () => {
    expect(
      parseFindingInteraction("issue_comment", "feedback-2", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        issue: { number: 816, pull_request: {} },
        sender: { login: "outside" },
        comment: {
          body: `/ai-review acknowledge f_${"a".repeat(24)} agreed`,
          author_association: "CONTRIBUTOR",
          user: { login: "outside" },
        },
      }),
    ).toEqual({ kind: "ignored", reason: "unsupported-event" });

    expect(
      parseFindingInteraction("issue_comment", "feedback-spoofed", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        issue: { number: 816, pull_request: {} },
        sender: { login: "outside" },
        comment: {
          body: `/ai-review reject f_${"a".repeat(24)} spoofed actor`,
          author_association: "OWNER",
          user: { login: "robbie" },
        },
      }),
    ).toEqual({ kind: "ignored", reason: "unsupported-event" });
  });

  it("rejects incomplete disposition commands without regex backtracking", () => {
    const body = `/ai-review reject f_${"a".repeat(24)}${" ".repeat(100_000)}`;
    expect(
      parseFindingInteraction("issue_comment", "feedback-incomplete", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        issue: { number: 816, pull_request: {} },
        sender: { login: "robbie" },
        comment: {
          body,
          author_association: "OWNER",
          user: { login: "robbie" },
        },
      }),
    ).toEqual({ kind: "ignored", reason: "unsupported-event" });
  });

  it("validates malformed interaction envelopes and event-specific identities", () => {
    expect(parseFindingInteraction("issue_comment", "feedback", null)).toEqual({
      kind: "invalid",
      reason: "Malformed webhook payload",
    });
    expect(parseFindingInteraction("issue_comment", "", { action: "created" })).toEqual({
      kind: "invalid",
      reason: "Malformed webhook payload",
    });
    expect(
      parseFindingInteraction("issue_comment", "feedback", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
      }),
    ).toEqual({ kind: "ignored", reason: "unsupported-event" });
    expect(
      parseFindingInteraction("issue_comment", "feedback", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        sender: { login: "Robbie-Palmer" },
        comment: {
          body: `/ai-review acknowledge f_${"a".repeat(24)} accepted`,
        },
      }),
    ).toEqual({ kind: "invalid", reason: "Malformed webhook payload" });
    expect(
      parseFindingInteraction("pull_request_review_comment", "feedback", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        pull_request: { number: 816 },
        comment: { id: 201 },
      }),
    ).toEqual({ kind: "ignored", reason: "unsupported-event" });
    expect(
      parseFindingInteraction("pull_request_review_thread", "feedback", {
        action: "resolved",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        pull_request: { number: 816 },
        sender: { login: "Robbie-Palmer" },
        thread: { comments: [] },
      }),
    ).toEqual({ kind: "invalid", reason: "Malformed webhook payload" });
  });

  it("accepts a trusted pull request author and rejects untrusted reply actors", () => {
    const reply = {
      action: "edited",
      repository: { full_name: "Robbie-Palmer/personal-site" },
      pull_request: {
        number: 816,
        author_association: "MEMBER",
        user: { login: "maintainer" },
      },
      sender: { login: "maintainer" },
      comment: {
        id: 201,
        in_reply_to_id: 200,
        body: "Updated reply",
        created_at: "2026-08-09T12:00:00Z",
      },
    };
    expect(
      parseFindingInteraction(
        "pull_request_review_comment",
        "feedback-author",
        reply,
      ),
    ).toEqual({
      kind: "accepted",
      event: expect.objectContaining({ actor: "maintainer", action: "edited" }),
    });
    expect(
      parseFindingInteraction(
        "pull_request_review_comment",
        "feedback-outsider",
        {
          ...reply,
          pull_request: { number: 816 },
          sender: { login: "outside" },
        },
      ),
    ).toEqual({ kind: "ignored", reason: "unsupported-event" });
  });

  it("captures replies, reaction snapshots, and thread resolution", () => {
    expect(
      parseFindingInteraction("pull_request_review_comment", "feedback-3", {
        action: "created",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        pull_request: { number: 816 },
        sender: { login: "maintainer" },
        comment: {
          id: 201,
          in_reply_to_id: 200,
          body: "Good catch; fixed in the next commit.",
          author_association: "COLLABORATOR",
          user: { login: "maintainer" },
          reactions: { url: "ignored", "+1": 2, confused: 0 },
        },
      }),
    ).toEqual({
      kind: "accepted",
      event: expect.objectContaining({
        interactionType: "reply",
        rootCommentId: 200,
        commentId: 201,
        reactions: { "+1": 2, confused: 0 },
      }),
    });

    expect(
      parseFindingInteraction("pull_request_review_thread", "feedback-4", {
        action: "resolved",
        repository: { full_name: "Robbie-Palmer/personal-site" },
        pull_request: { number: 816 },
        sender: { login: "Robbie-Palmer" },
        thread: {
          node_id: "PRRT_thread",
          comments: [{ id: 200, reactions: { "+1": 1, heart: 2 } }],
          updated_at: "2026-08-09T12:10:00Z",
        },
      }),
    ).toEqual({
      kind: "accepted",
      event: expect.objectContaining({
        interactionType: "thread",
        action: "resolved",
        rootCommentId: 200,
        reactions: { "+1": 1, heart: 2 },
      }),
    });
  });
});

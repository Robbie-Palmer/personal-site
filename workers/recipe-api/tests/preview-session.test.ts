import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clientEnd: vi.fn(),
  createAuth: vi.fn(),
  createDb: vi.fn(),
  signInEmail: vi.fn(),
}));

vi.mock("recipe-db", () => ({ createDb: mocks.createDb }));
vi.mock("../src/auth", () => ({ createAuth: mocks.createAuth }));

import {
  createPreviewSessionCookie,
  type PreviewSessionEnvironment,
} from "../scripts/preview-session";

const environment: PreviewSessionEnvironment = {
  DATABASE_URL: "postgres://preview.test/database",
  BETTER_AUTH_URL: "https://pr-123.example.test",
  BETTER_AUTH_SECRET: "auth-secret",
  PREVIEW_AUTH_PASSWORD: "preview-password",
};

describe("createPreviewSessionCookie", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createDb.mockReturnValue({
      client: { end: mocks.clientEnd },
      db: "preview-db",
    });
    mocks.createAuth.mockReturnValue({
      api: { signInEmail: mocks.signInEmail },
    });
  });

  it("signs in against the preview database and closes its resources", async () => {
    const response = new Response("unused", {
      headers: {
        "set-cookie": "better-auth.session_token=session-token; Path=/",
      },
    });
    const cancel = vi.spyOn(response.body!, "cancel");
    mocks.signInEmail.mockResolvedValue(response);

    await expect(
      createPreviewSessionCookie(environment, "cook@preview.invalid"),
    ).resolves.toBe("better-auth.session_token=session-token");
    expect(mocks.createDb).toHaveBeenCalledWith(environment.DATABASE_URL);
    expect(mocks.createAuth).toHaveBeenCalledWith("preview-db", {
      DEPLOYMENT_ENV: "preview",
      BETTER_AUTH_URL: environment.BETTER_AUTH_URL,
      BETTER_AUTH_SECRET: environment.BETTER_AUTH_SECRET,
    });
    expect(mocks.signInEmail).toHaveBeenCalledWith({
      body: {
        email: "cook@preview.invalid",
        password: environment.PREVIEW_AUTH_PASSWORD,
      },
      asResponse: true,
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.clientEnd).toHaveBeenCalledWith({ timeout: 5 });
  });

  it("closes the database when sign-in fails", async () => {
    mocks.signInEmail.mockRejectedValue(new Error("sign-in failed"));

    await expect(
      createPreviewSessionCookie(environment, "cook@preview.invalid"),
    ).rejects.toThrow("sign-in failed");
    expect(mocks.clientEnd).toHaveBeenCalledWith({ timeout: 5 });
  });

  it("closes the response and database when no cookie is returned", async () => {
    mocks.signInEmail.mockResolvedValue(new Response(null, { status: 401 }));

    await expect(
      createPreviewSessionCookie(environment, "cook@preview.invalid"),
    ).rejects.toThrow(
      "Better Auth response did not include a session cookie (401)",
    );
    expect(mocks.clientEnd).toHaveBeenCalledWith({ timeout: 5 });
  });
});

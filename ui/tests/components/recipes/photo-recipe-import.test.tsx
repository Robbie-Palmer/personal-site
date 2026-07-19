import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PhotoRecipeImport,
  type PhotoRecipeImportDraft,
} from "@/components/recipes/photo-recipe-import";

const draft: PhotoRecipeImportDraft = {
  cooklang: {
    frontmatter: { title: "Tomato pasta" },
    body: "Cook @pasta{200%g}.",
  },
  recipe: {
    title: "Tomato pasta",
    description: "A quick pasta",
    cuisine: ["Italian"],
    servings: 2,
  },
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

describe("PhotoRecipeImport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not reapply a completed job when the tab is reactivated", async () => {
    const onDraftReady = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "job-1", status: "queued" }))
      .mockResolvedValueOnce(
        jsonResponse({ id: "job-1", status: "succeeded", draft }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(
      <PhotoRecipeImport active onDraftReady={onDraftReady} />,
    );
    const input = screen.getByLabelText("Choose recipe photos");
    fireEvent.change(input, {
      target: {
        files: [new File(["photo"], "recipe.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import from photos" }));

    await waitFor(() => expect(onDraftReady).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledTimes(2);

    rerender(<PhotoRecipeImport active={false} onDraftReady={onDraftReady} />);
    rerender(<PhotoRecipeImport active onDraftReady={onDraftReady} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(onDraftReady).toHaveBeenCalledOnce();
  });

  it("keeps the hidden file inputs out of sequential keyboard navigation", () => {
    render(<PhotoRecipeImport active onDraftReady={vi.fn()} />);

    expect(screen.getByLabelText("Take a recipe photo")).toHaveAttribute(
      "tabindex",
      "-1",
    );
    expect(screen.getByLabelText("Choose recipe photos")).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });
});

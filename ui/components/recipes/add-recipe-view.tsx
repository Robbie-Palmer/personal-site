"use client";

import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileText,
  Globe2,
  Images,
  Loader2,
  PenLine,
  Save,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { RecipeContent } from "@/components/recipes/recipe-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCooklangRecipe } from "@/hooks/use-cooklang-recipe";
import { authClient } from "@/lib/auth-client";
import {
  buildRecipeDraft,
  normalizeRecipeSource,
  serializeSavedRecipe,
} from "@/lib/domain/recipe/recipeDraft";
import { recipeSaveReturnPath } from "@/lib/generic/safe-return-path";
import { normalizeSlug } from "@/lib/generic/slugs";

const EXAMPLE_RECIPE = `Bring a large #pot{} of salted water to the boil. Add @dried pasta{200%g} and cook for ~{10%minutes}.

Meanwhile, warm @olive oil{2%tbsp} in a #frying pan{}. Add @garlic{2%cloves} and cook for ~{2%minutes}.

Stir in @chopped tomatoes{400%g} and simmer for ~{15%minutes}. Drain the pasta, toss it through the sauce, and serve.`;

type AddMethod = "write" | "url" | "photo";

type ImportedRecipe = {
  title: string;
  description: string;
  cuisine: string;
  servings: number;
  prepTime?: number;
  cookTime?: number;
  source: string;
  url: string;
};

type PhotoImportStatus = "queued" | "running" | "succeeded" | "failed";

type PhotoImportDraft = {
  cooklang: {
    frontmatter: {
      title?: string;
      description?: string;
      cuisine?: string[];
      servings?: number;
      prepTime?: number;
      cookTime?: number;
    };
    body: string;
  };
  recipe: {
    title: string;
    description: string;
    cuisine: string[];
    servings: number;
    prepTime?: number;
    cookTime?: number;
  };
};

type PhotoImportJob = {
  id: string;
  status: PhotoImportStatus;
  currentStage?: "extract" | "normalize" | "canonicalize" | "finalize";
  progressLabel?: string;
  error?: { message?: string };
  draft?: PhotoImportDraft;
};

const PHOTO_IMPORT_POLL_INTERVAL_MS = 1_500;
const MAX_PHOTO_COUNT = 6;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function NumberField({
  label,
  value,
  onChange,
  min = 0,
}: Readonly<{
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
}>) {
  const id = useId();
  return (
    <label htmlFor={id} className="grid gap-1.5">
      <span className="rt-mono text-[var(--ink-3)]">{label}</span>
      <Input
        id={id}
        type="number"
        min={min}
        value={value ?? ""}
        onChange={(event) => {
          if (!event.target.value) {
            onChange(undefined);
            return;
          }
          const nextValue = Number(event.target.value);
          onChange(
            Number.isInteger(nextValue) && nextValue >= min
              ? nextValue
              : undefined,
          );
        }}
        className="border-[var(--line-strong)] bg-[var(--card)]"
      />
    </label>
  );
}

export function AddRecipeView() {
  const titleId = useId();
  const descriptionId = useId();
  const cuisineId = useId();
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [method, setMethod] = useState<AddMethod>("write");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedUrl, setImportedUrl] = useState<string | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoJob, setPhotoJob] = useState<PhotoImportJob | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [servings, setServings] = useState<number | undefined>(2);
  const [prepTime, setPrepTime] = useState<number | undefined>();
  const [cookTime, setCookTime] = useState<number | undefined>();
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const importRequestRef = useRef<{
    id: number;
    controller: AbortController;
  } | null>(null);
  const nextImportRequestIdRef = useRef(0);
  const photoRequestRef = useRef<AbortController | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const cooklang = useMemo(() => normalizeRecipeSource(source), [source]);
  const parse = useCooklangRecipe(cooklang);

  const previewResult = useMemo(() => {
    if (!parse.recipe || !title.trim() || !description.trim() || !servings)
      return { recipe: null, error: false };
    try {
      return {
        recipe: buildRecipeDraft(
          parse.recipe,
          {
            title,
            description,
            cuisine,
            servings,
            prepTime,
            cookTime,
            canonical: importedUrl ?? undefined,
          },
          source,
        ),
        error: false,
      };
    } catch {
      return { recipe: null, error: true };
    }
  }, [
    parse.recipe,
    title,
    description,
    cuisine,
    servings,
    prepTime,
    cookTime,
    importedUrl,
    source,
  ]);
  const preview = previewResult.recipe;
  const photoJobId = photoJob?.id;
  const photoJobStatus = photoJob?.status;

  useEffect(() => {
    if (
      !photoJobId ||
      !photoJobStatus ||
      !["queued", "running"].includes(photoJobStatus)
    )
      return;

    let active = true;
    const controller = new AbortController();
    photoRequestRef.current = controller;

    async function poll() {
      try {
        const response = await fetch(`/api/recipe-imports/${photoJobId}`, {
          credentials: "include",
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as
          | PhotoImportJob
          | { error?: string }
          | null;
        if (!response.ok || !body || !("status" in body)) {
          throw new Error(
            (body && "error" in body && body.error) ||
              "We couldn't check the photo import status.",
          );
        }
        if (!active) return;
        setPhotoJob(body);
        if (body.status === "succeeded") {
          if (!body.draft) {
            setPhotoError(
              "The import finished without an editable recipe draft.",
            );
            return;
          }
          const { frontmatter, body: cooklangBody } = body.draft.cooklang;
          const recipe = body.draft.recipe;
          setTitle(frontmatter.title ?? recipe.title);
          setDescription(frontmatter.description ?? recipe.description);
          setCuisine((frontmatter.cuisine ?? recipe.cuisine)[0] ?? "");
          setServings(frontmatter.servings ?? recipe.servings);
          setPrepTime(frontmatter.prepTime ?? recipe.prepTime);
          setCookTime(frontmatter.cookTime ?? recipe.cookTime);
          setSource(cooklangBody);
          setImportedUrl(null);
        } else if (body.status === "failed") {
          setPhotoError(
            body.error?.message ||
              "We couldn't read a recipe from those photos. Try clearer, well-lit images.",
          );
        }
      } catch (error) {
        if (!controller.signal.aborted && active) {
          setPhotoError(
            error instanceof Error
              ? error.message
              : "We couldn't check the photo import status.",
          );
        }
      }
    }

    void poll();
    const interval = window.setInterval(
      () => void poll(),
      PHOTO_IMPORT_POLL_INTERVAL_MS,
    );
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      if (photoRequestRef.current === controller)
        photoRequestRef.current = null;
    };
  }, [photoJobId, photoJobStatus]);

  async function importRecipeUrl() {
    if (!recipeUrl.trim() || importing) return;
    importRequestRef.current?.controller.abort();
    const request = {
      id: ++nextImportRequestIdRef.current,
      controller: new AbortController(),
    };
    importRequestRef.current = request;
    setImporting(true);
    setImportError(null);
    try {
      const response = await fetch("/api/recipes/import-url", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: recipeUrl.trim() }),
        signal: request.controller.signal,
      });
      const body = (await response.json().catch(() => null)) as
        | ImportedRecipe
        | { error?: string }
        | null;
      if (!response.ok || !body || !("source" in body)) {
        throw new Error(
          (body && "error" in body && body.error) ||
            "The recipe could not be imported.",
        );
      }
      if (importRequestRef.current?.id !== request.id) return;
      setTitle(body.title);
      setDescription(body.description);
      setCuisine(body.cuisine);
      setServings(body.servings);
      setPrepTime(body.prepTime);
      setCookTime(body.cookTime);
      setSource(body.source);
      setRecipeUrl(body.url);
      setImportedUrl(body.url);
    } catch (error) {
      if (
        request.controller.signal.aborted ||
        importRequestRef.current?.id !== request.id
      ) {
        return;
      }
      setImportError(
        error instanceof Error
          ? error.message
          : "The recipe could not be imported.",
      );
    } finally {
      if (importRequestRef.current?.id === request.id) {
        importRequestRef.current = null;
        setImporting(false);
      }
    }
  }

  function invalidateImportRequest() {
    importRequestRef.current?.controller.abort();
    importRequestRef.current = null;
    setImporting(false);
  }

  function addPhotoFiles(files: FileList | null) {
    if (!files?.length) return;
    setPhotoError(null);
    const incoming = Array.from(files);
    const unsupported = incoming.find(
      (file) => !ACCEPTED_PHOTO_TYPES.has(file.type),
    );
    if (unsupported) {
      setPhotoError("Choose JPEG, PNG, or WebP images.");
      return;
    }
    const oversized = incoming.find((file) => file.size > MAX_PHOTO_BYTES);
    if (oversized) {
      setPhotoError(`“${oversized.name}” is larger than 10 MB.`);
      return;
    }
    setPhotoFiles((current) => {
      const combined = [...current, ...incoming];
      if (combined.length > MAX_PHOTO_COUNT) {
        setPhotoError(
          `You can import up to ${MAX_PHOTO_COUNT} photos at once.`,
        );
        return current;
      }
      return combined;
    });
  }

  async function importRecipePhotos() {
    if (!photoFiles.length || uploadingPhotos || photoJob?.status === "running")
      return;
    setUploadingPhotos(true);
    setPhotoError(null);
    setPhotoJob(null);
    const form = new FormData();
    for (const file of photoFiles) form.append("images", file);
    try {
      const response = await fetch("/api/recipe-imports", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const body = (await response.json().catch(() => null)) as
        | PhotoImportJob
        | { error?: string }
        | null;
      if (!response.ok || !body || !("status" in body)) {
        throw new Error(
          (body && "error" in body && body.error) ||
            "The photos could not be uploaded.",
        );
      }
      setPhotoJob(body);
    } catch (error) {
      setPhotoError(
        error instanceof Error
          ? error.message
          : "The photos could not be uploaded.",
      );
    } finally {
      setUploadingPhotos(false);
    }
  }

  async function saveRecipe() {
    if (!preview || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: normalizeSlug(title),
          title: title.trim(),
          description: description.trim(),
          body: serializeSavedRecipe(source, preview),
          visibility: "private",
        }),
      });
      if (!response.ok) {
        if (response.status === 409) {
          throw new Error(
            "A recipe with this name already exists. Choose a different name.",
          );
        }
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          details?: Array<{ message?: string }>;
        } | null;
        const details = body?.details
          ?.map((detail) => detail.message)
          .filter((message): message is string => Boolean(message))
          .join(" ");
        throw new Error(
          details || body?.error || "The recipe could not be saved.",
        );
      }
      const saved = (await response.json()) as { slug: string };
      const returnTo = new URLSearchParams(window.location.search).get(
        "returnTo",
      );
      const safeReturnTo = recipeSaveReturnPath(
        returnTo,
        saved.slug,
        window.location.origin,
      );
      router.push(
        safeReturnTo ?? `/recipes/saved?slug=${encodeURIComponent(saved.slug)}`,
      );
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The recipe could not be saved.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (sessionPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <FileText className="mx-auto size-10 text-[var(--terracotta)]" />
        <h1 className="rt-display mt-4 text-5xl">Log in to save a recipe</h1>
        <p className="rt-body mt-3 text-[var(--ink-2)]">
          Use the log-in button above, then come back to add recipes to your
          private recipe box.
        </p>
        <Button asChild variant="outline" className="mt-6 rounded-full">
          <Link href="/recipes">
            <ArrowLeft /> Back to recipes
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-[1600px] px-4 py-6 md:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/recipes"
            className="rt-mono inline-flex items-center gap-1 text-[var(--ink-3)] hover:text-[var(--terracotta)]"
          >
            <ArrowLeft className="size-3.5" /> Recipe box
          </Link>
          <h1 className="rt-display mt-2 text-5xl sm:text-6xl">
            Add a <span className="text-[var(--terracotta)]">recipe</span>
          </h1>
          <p className="rt-body mt-2 text-[var(--ink-2)]">
            Write with Cooklang, import a webpage, or scan a recipe photo. Every
            method feeds the same editable preview.
          </p>
        </div>
        <Button
          onClick={saveRecipe}
          disabled={!preview || saving}
          className="rounded-full bg-[var(--ink)] px-5 text-[var(--paper)] hover:bg-[var(--terracotta-deep)]"
        >
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Save recipe
        </Button>
      </div>

      {saveError && (
        <div
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="size-4" />
          {saveError}
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(380px,0.8fr)_minmax(540px,1.2fr)]">
        <section className="rounded-xl border-[1.25px] border-[var(--line-strong)] bg-[var(--card)] p-4 shadow-[var(--paper-shadow)] xl:sticky xl:top-24">
          <div className="grid gap-4">
            <fieldset
              className="grid grid-cols-3 rounded-lg border border-[var(--line-strong)] bg-[var(--paper-warm)] p-1"
              aria-label="Choose how to add a recipe"
            >
              <button
                type="button"
                onClick={() => {
                  invalidateImportRequest();
                  setMethod("write");
                }}
                aria-pressed={method === "write"}
                className={`rt-mono inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  method === "write"
                    ? "bg-[var(--card)] text-[var(--ink)] shadow-sm"
                    : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                }`}
              >
                <PenLine className="size-4" /> Write with Cooklang
              </button>
              <button
                type="button"
                onClick={() => setMethod("url")}
                aria-pressed={method === "url"}
                className={`rt-mono inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  method === "url"
                    ? "bg-[var(--card)] text-[var(--ink)] shadow-sm"
                    : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                }`}
              >
                <Globe2 className="size-4" /> Import from URL
              </button>
              <button
                type="button"
                onClick={() => {
                  invalidateImportRequest();
                  setMethod("photo");
                }}
                aria-pressed={method === "photo"}
                className={`rt-mono inline-flex items-center justify-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                  method === "photo"
                    ? "bg-[var(--card)] text-[var(--ink)] shadow-sm"
                    : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                }`}
              >
                <Camera className="size-4" /> Scan photo
              </button>
            </fieldset>

            {method === "url" && (
              <div className="grid gap-2 rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--paper-warm)] p-3">
                <label htmlFor="recipe-import-url" className="grid gap-1.5">
                  <span className="rt-mono text-[var(--ink-3)]">
                    Recipe webpage URL
                  </span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="recipe-import-url"
                      type="url"
                      value={recipeUrl}
                      onChange={(event) => {
                        invalidateImportRequest();
                        setRecipeUrl(event.target.value);
                        setImportError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void importRecipeUrl();
                        }
                      }}
                      placeholder="https://example.com/recipes/tomato-pasta"
                      className="min-w-0 flex-1 border-[var(--line-strong)] bg-[var(--paper)]"
                    />
                    <Button
                      type="button"
                      onClick={() => void importRecipeUrl()}
                      disabled={!recipeUrl.trim() || importing}
                      className="bg-[var(--terracotta)] text-white hover:bg-[var(--terracotta-deep)]"
                    >
                      {importing ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Globe2 className="size-4" />
                      )}
                      {importing ? "Importing…" : "Import recipe"}
                    </Button>
                  </div>
                </label>
                <p className="text-xs text-[var(--ink-3)]">
                  The page must publish schema.org Recipe data with a name,
                  ingredients and instructions.
                </p>
                {importError && (
                  <p
                    role="alert"
                    className="flex items-start gap-1.5 text-sm text-destructive"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {importError}
                  </p>
                )}
                {importedUrl && !importError && (
                  <output className="text-sm text-[var(--sage)]">
                    Imported successfully. You can edit any field before saving.
                  </output>
                )}
              </div>
            )}

            {method === "photo" && (
              <div className="grid gap-3 rounded-lg border border-dashed border-[var(--line-strong)] bg-[var(--paper-warm)] p-3">
                <div>
                  <p className="rt-mono text-[var(--ink-3)]">Recipe photos</p>
                  <p className="mt-1 text-xs text-[var(--ink-3)]">
                    Add up to six clear photos. Include every ingredient list
                    and instruction page.
                  </p>
                </div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => {
                    addPhotoFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    addPhotoFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera /> Take photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Images /> Choose photos
                  </Button>
                </div>
                {photoFiles.length > 0 && (
                  <ul
                    className="grid gap-1.5"
                    aria-label="Selected recipe photos"
                  >
                    {photoFiles.map((file, index) => (
                      <li
                        key={`${file.name}-${file.lastModified}-${index}`}
                        className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--card)] px-2.5 py-2 text-sm"
                      >
                        <FileText className="size-4 shrink-0 text-[var(--terracotta)]" />
                        <span className="min-w-0 flex-1 truncate">
                          {file.name}
                        </span>
                        <span className="text-xs text-[var(--ink-4)]">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${file.name}`}
                          className="rounded p-1 text-[var(--ink-3)] hover:bg-[var(--paper-warm)] hover:text-[var(--ink)]"
                          onClick={() =>
                            setPhotoFiles((files) =>
                              files.filter(
                                (_, fileIndex) => fileIndex !== index,
                              ),
                            )
                          }
                        >
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  type="button"
                  onClick={() => void importRecipePhotos()}
                  disabled={
                    !photoFiles.length ||
                    uploadingPhotos ||
                    photoJob?.status === "queued" ||
                    photoJob?.status === "running"
                  }
                  className="bg-[var(--terracotta)] text-white hover:bg-[var(--terracotta-deep)]"
                >
                  {uploadingPhotos ||
                  photoJob?.status === "queued" ||
                  photoJob?.status === "running" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Upload />
                  )}
                  {uploadingPhotos
                    ? "Uploading…"
                    : photoJob?.status === "queued" ||
                        photoJob?.status === "running"
                      ? "Reading recipe…"
                      : "Import from photos"}
                </Button>
                {photoJob && (
                  <div
                    className="flex items-start gap-2 rounded-md border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm"
                    role="status"
                    aria-live="polite"
                  >
                    {photoJob.status === "succeeded" ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--sage)]" />
                    ) : photoJob.status === "failed" ? (
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-[var(--terracotta)]" />
                    )}
                    <span>
                      {photoJob.progressLabel ??
                        (photoJob.status === "queued"
                          ? "Waiting to read your photos"
                          : "Processing your recipe")}
                      {photoJob.status === "succeeded" &&
                        " — refine it below, then save it to your recipe box."}
                    </span>
                  </div>
                )}
                {photoError && (
                  <p
                    role="alert"
                    className="flex items-start gap-1.5 text-sm text-destructive"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {photoError}
                  </p>
                )}
              </div>
            )}

            <label htmlFor={titleId} className="grid gap-1.5">
              <span className="rt-mono text-[var(--ink-3)]">Recipe name</span>
              <Input
                id={titleId}
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Weeknight tomato pasta"
                className="border-[var(--line-strong)] bg-[var(--paper)] text-lg"
              />
            </label>
            <label htmlFor={descriptionId} className="grid gap-1.5">
              <span className="rt-mono text-[var(--ink-3)]">
                Short description
              </span>
              <Input
                id={descriptionId}
                value={description}
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="A quick, cosy pasta for busy evenings"
                className="border-[var(--line-strong)] bg-[var(--paper)]"
              />
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
              <NumberField
                label="Servings"
                value={servings}
                min={1}
                onChange={setServings}
              />
              <NumberField
                label="Prep minutes"
                value={prepTime}
                onChange={setPrepTime}
              />
              <NumberField
                label="Cook minutes"
                value={cookTime}
                onChange={setCookTime}
              />
              <label htmlFor={cuisineId} className="grid gap-1.5">
                <span className="rt-mono text-[var(--ink-3)]">Cuisine</span>
                <Input
                  id={cuisineId}
                  value={cuisine}
                  onChange={(event) => setCuisine(event.target.value)}
                  placeholder="Italian"
                  className="border-[var(--line-strong)] bg-[var(--card)]"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-dashed border-[var(--line-strong)] pt-3">
              <div>
                <p className="rt-mono text-[var(--ink-3)]">Recipe text</p>
                <p className="text-xs text-[var(--ink-3)]">
                  {method === "url" || method === "photo"
                    ? "Imported as editable Cooklang. Adjust anything before saving."
                    : "Use @ingredients, #cookware and ~timers directly in each step."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  invalidateImportRequest();
                  setTitle("Weeknight tomato pasta");
                  setDescription("A quick, cosy pasta for busy evenings.");
                  setCuisine("Italian");
                  setPrepTime(5);
                  setCookTime(25);
                  setSource(EXAMPLE_RECIPE);
                  setImportedUrl(null);
                }}
              >
                <Sparkles /> Try example
              </Button>
            </div>
            <textarea
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder={EXAMPLE_RECIPE}
              maxLength={10000}
              spellCheck
              className="rt-body min-h-[360px] w-full resize-y rounded-lg border border-[var(--line-strong)] bg-[var(--paper)] p-3 text-base leading-relaxed outline-none transition-shadow placeholder:text-[var(--ink-4)] focus:border-[var(--terracotta)] focus:ring-3 focus:ring-[var(--terracotta)]/15"
            />
          </div>
        </section>

        <section className="min-h-[600px] overflow-hidden rounded-xl border-[1.25px] border-[var(--line-strong)] bg-[var(--paper)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper-warm)] px-4 py-3">
            <p className="rt-mono text-[var(--ink-3)]">Live preview</p>
            <div className="flex items-center gap-2">
              <span className="rt-mono text-[var(--ink-4)]">
                Timers activate after saving
              </span>
              {parse.loading && (
                <Loader2 className="size-4 animate-spin text-[var(--terracotta)]" />
              )}
            </div>
          </div>
          {preview ? (
            <div className="px-4 py-6 md:px-8">
              <RecipeContent recipe={preview} timersEnabled={false} />
            </div>
          ) : (
            <div className="flex min-h-[540px] flex-col items-center justify-center px-6 text-center">
              <FileText className="size-12 text-[var(--terracotta)]/50" />
              <h2 className="rt-display mt-4 text-4xl">
                Your recipe will appear here
              </h2>
              <p className="rt-body mt-2 max-w-md text-[var(--ink-3)]">
                Add a name and write your steps with inline Cooklang—or use the
                example, URL importer, or a recipe photo to see ingredients and
                timers come alive.
              </p>
              {(parse.error || previewResult.error) && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  We couldn&apos;t read that recipe yet. Check the Cooklang
                  syntax and try again.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

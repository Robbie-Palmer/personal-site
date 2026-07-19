"use client";

import {
  AlertCircle,
  ArrowLeft,
  Camera,
  FileText,
  Globe2,
  Home,
  Loader2,
  LockKeyhole,
  PenLine,
  Save,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PhotoRecipeImport,
  type PhotoRecipeImportDraft,
} from "@/components/recipes/photo-recipe-import";
import { RecipeContent } from "@/components/recipes/recipe-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCooklangRecipe } from "@/hooks/use-cooklang-recipe";
import { getHouseholds } from "@/lib/api/households";
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
type RecipeVisibility = "private" | "household" | "public";

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
  const sessionUserId = session?.user.id;
  const [method, setMethod] = useState<AddMethod>("write");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedUrl, setImportedUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [servings, setServings] = useState<number | undefined>(2);
  const [prepTime, setPrepTime] = useState<number | undefined>();
  const [cookTime, setCookTime] = useState<number | undefined>();
  const [source, setSource] = useState("");
  const [visibility, setVisibility] = useState<RecipeVisibility>("private");
  const [householdPending, setHouseholdPending] = useState(true);
  const [hasHousehold, setHasHousehold] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const visibilityTouchedRef = useRef(false);
  const importRequestRef = useRef<{
    id: number;
    controller: AbortController;
  } | null>(null);
  const nextImportRequestIdRef = useRef(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const cooklang = useMemo(() => normalizeRecipeSource(source), [source]);
  const parse = useCooklangRecipe(cooklang);

  useEffect(() => {
    if (sessionPending) return;
    if (!sessionUserId) {
      visibilityTouchedRef.current = false;
      setHouseholdPending(false);
      setHasHousehold(false);
      setVisibility("private");
      return;
    }

    const controller = new AbortController();
    visibilityTouchedRef.current = false;
    setHouseholdPending(true);
    void getHouseholds(controller.signal)
      .then((households) => {
        const available = households.length > 0;
        setHasHousehold(available);
        if (!visibilityTouchedRef.current) {
          setVisibility(available ? "household" : "private");
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setHasHousehold(false);
        if (!visibilityTouchedRef.current) setVisibility("private");
      })
      .finally(() => {
        if (!controller.signal.aborted) setHouseholdPending(false);
      });
    return () => controller.abort();
  }, [sessionPending, sessionUserId]);

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

  const applyPhotoDraft = useCallback((draft: PhotoRecipeImportDraft) => {
    const { frontmatter, body } = draft.cooklang;
    setTitle(frontmatter.title ?? draft.recipe.title);
    setDescription(frontmatter.description ?? draft.recipe.description);
    setCuisine((frontmatter.cuisine ?? draft.recipe.cuisine).join(", "));
    setServings(frontmatter.servings ?? draft.recipe.servings);
    setPrepTime(draft.recipe.prepTime);
    setCookTime(draft.recipe.cookTime);
    setSource(body);
    setImportedUrl(null);
  }, []);

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
          visibility,
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
          disabled={!preview || saving || householdPending}
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

            <div className={method === "photo" ? undefined : "hidden"}>
              <PhotoRecipeImport
                active={method === "photo"}
                onDraftReady={applyPhotoDraft}
              />
            </div>

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
            <fieldset className="grid gap-2">
              <legend className="rt-mono text-[var(--ink-3)]">
                Who can see this recipe?
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["private", LockKeyhole, "Private"],
                    ["household", Home, "Household"],
                    ["public", Globe2, "Public"],
                  ] as const
                ).map(([value, Icon, label]) => {
                  const disabled =
                    value === "household" &&
                    (householdPending || !hasHousehold);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={visibility === value}
                      disabled={disabled}
                      onClick={() => {
                        visibilityTouchedRef.current = true;
                        setVisibility(value);
                      }}
                      className={`rt-body inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        visibility === value
                          ? "border-[var(--terracotta)] bg-[var(--butter-soft)] text-[var(--terracotta-deep)]"
                          : "border-[var(--line-strong)] bg-[var(--paper)] text-[var(--ink-3)] hover:text-[var(--ink)]"
                      }`}
                    >
                      <Icon className="size-4" /> {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[var(--ink-3)]">
                {visibility === "private" && "Only you can open this recipe."}
                {visibility === "household" &&
                  "Everyone in your household can open this recipe."}
                {visibility === "public" &&
                  "Anyone can open this recipe from the public feed."}
                {!householdPending && !hasHousehold && (
                  <> Join a household to share recipes with its members.</>
                )}
              </p>
            </fieldset>
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

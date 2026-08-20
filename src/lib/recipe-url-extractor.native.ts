import { createRecipeInput, type CreateRecipeInput } from "@/types/recipe";

export interface ExtractRecipeFromUrlOptions {
  url: string;
  signal?: AbortSignal;
}
export interface ExtractedRecipeFromUrl {
  recipe: CreateRecipeInput;
  sourceUrl: string;
  sourceName: string;
}
type JsonLd =
  | string
  | number
  | boolean
  | null
  | JsonLd[]
  | { [key: string]: JsonLd };
const MAX_HTML_LENGTH = 2_000_000;

/** Native fetch has no browser CORS restriction, so URL extraction stays fully on-device. */
export async function extractRecipeFromUrl(
  options: ExtractRecipeFromUrlOptions,
): Promise<ExtractedRecipeFromUrl> {
  let source: URL;
  try {
    source = new URL(options.url);
  } catch {
    throw new Error("Invalid recipe URL.");
  }
  if (source.protocol !== "https:" && source.protocol !== "http:")
    throw new Error("Invalid recipe URL.");

  const response = await fetch(source.toString(), {
    headers: { Accept: "text/html,application/xhtml+xml" },
    signal: options.signal,
  });
  if (!response.ok) throw new Error("Could not fetch recipe site.");
  const html = await response.text();
  if (html.length > MAX_HTML_LENGTH)
    throw new Error("Recipe page is too large.");
  const value = findRecipe(html);
  if (!value) throw new Error("Site doesn't support extraction.");

  const title = stringValue(value.name).trim();
  const description =
    stringValue(value.description).trim() ||
    `Imported from ${source.hostname.replace(/^www\./, "")}`;
  const ingredients = stringArray(value.recipeIngredient);
  const steps = instructionTexts(value.recipeInstructions);
  if (!title || ingredients.length === 0 || steps.length === 0)
    throw new Error("Site doesn't support extraction.");

  const finalUrl = new URL(response.url || source.toString());
  return {
    recipe: createRecipeInput.parse({ title, description, ingredients, steps }),
    sourceUrl: finalUrl.toString(),
    sourceName: finalUrl.hostname.replace(/^www\./, ""),
  };
}

function findRecipe(html: string): Record<string, JsonLd> | null {
  const pattern =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const block = decodeEntities(match[1]?.trim() ?? "");
    try {
      const found = findRecipeObject(JSON.parse(block) as JsonLd);
      if (found) return found;
    } catch {
      /* try the next JSON-LD block */
    }
  }
  return null;
}

function findRecipeObject(value: JsonLd): Record<string, JsonLd> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeObject(item);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  if (isRecipeType(value["@type"])) return value;
  const graph = value["@graph"];
  return graph === undefined ? null : findRecipeObject(graph);
}

function isRecipeType(value: unknown): boolean {
  if (typeof value === "string") return value.toLowerCase() === "recipe";
  return (
    Array.isArray(value) &&
    value.some(
      (item) => typeof item === "string" && item.toLowerCase() === "recipe",
    )
  );
}
function instructionTexts(value: JsonLd | undefined): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value))
    return value.flatMap(instructionTexts).filter(Boolean);
  if (!isRecord(value)) return [];
  const text = stringValue(value.text as JsonLd).trim();
  return text
    ? [text]
    : instructionTexts(value.itemListElement as JsonLd | undefined);
}
function stringArray(value: JsonLd | undefined): string[] {
  return Array.isArray(value)
    ? value
        .map(stringValue)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}
function stringValue(value: JsonLd | undefined): string {
  return typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : "";
}
function decodeEntities(value: string): string {
  return value
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

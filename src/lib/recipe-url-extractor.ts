import { createRecipeInput } from "@/types/recipe";
import type { CreateRecipeInput } from "@/types/recipe";

const EXTRACT_RECIPE_URL_ENDPOINT = "/api/extract-recipe-url";

export interface ExtractRecipeFromUrlOptions {
  url: string;
  signal?: AbortSignal;
}

export interface ExtractedRecipeFromUrl {
  recipe: CreateRecipeInput;
  sourceUrl: string;
  sourceName: string;
}

interface WorkerSuccessResponse {
  ok: true;
  recipe: unknown;
  sourceUrl: string;
  sourceName: string;
}

interface WorkerErrorResponse {
  ok: false;
  code: string;
  message: string;
}

type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;

/**
 * Extract a structured recipe from a public recipe URL.
 *
 * The browser calls Chefness's same-origin Cloudflare Worker endpoint. The
 * Worker does the cross-origin page fetch server-side and returns only
 * normalized JSON-LD recipe data or a small error payload.
 */
export async function extractRecipeFromUrl(
  options: ExtractRecipeFromUrlOptions,
): Promise<ExtractedRecipeFromUrl> {
  const response = await fetch(EXTRACT_RECIPE_URL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: options.url }),
    signal: options.signal,
  });

  const payload = await parseWorkerResponse(response);

  if (!payload.ok) {
    throw new Error(userMessageForError(payload));
  }

  const recipe = createRecipeInput.parse(payload.recipe);

  return {
    recipe,
    sourceUrl: payload.sourceUrl,
    sourceName: payload.sourceName,
  };
}

async function parseWorkerResponse(
  response: Response,
): Promise<WorkerResponse> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error("Could not read recipe extraction response.");
  }

  if (!isWorkerResponse(payload)) {
    throw new Error("Recipe extraction returned an unexpected response.");
  }

  if (!response.ok && payload.ok) {
    throw new Error("Recipe extraction returned an unexpected response.");
  }

  return payload;
}

function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") return false;

  if (value.ok) {
    return (
      "recipe" in value &&
      typeof value.sourceUrl === "string" &&
      typeof value.sourceName === "string"
    );
  }

  return typeof value.code === "string" && typeof value.message === "string";
}

function userMessageForError(payload: WorkerErrorResponse): string {
  if (payload.code === "NO_JSON_LD_RECIPE") {
    return "Site doesn't support extraction.";
  }

  return payload.message || "Could not extract recipe from that site.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

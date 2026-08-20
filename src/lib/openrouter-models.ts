import {
  openRouterModelsResponseSchema,
  type OpenRouterModel,
} from "@/types/openrouter-model";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

/** Stable OpenRouter router that selects among currently available free models. */
export const OPENROUTER_DEFAULT_MODEL = "openrouter/free";

/** Fetch the current public OpenRouter model catalog. */
export async function fetchOpenRouterModels(
  signal?: AbortSignal,
): Promise<OpenRouterModel[]> {
  const response = await fetch(OPENROUTER_MODELS_URL, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `OpenRouter model catalog request failed (${response.status}).`,
    );
  }

  const parsed = openRouterModelsResponseSchema.parse(await response.json());
  return parsed.data.sort((a, b) => a.name.localeCompare(b.name));
}

export function isFreeOpenRouterModel(model: OpenRouterModel): boolean {
  return (
    Number(model.pricing.prompt) === 0 && Number(model.pricing.completion) === 0
  );
}

export function supportsVision(model: OpenRouterModel): boolean {
  return model.architecture.input_modalities.includes("image");
}

export function supportsTools(model: OpenRouterModel): boolean {
  return model.supported_parameters.includes("tools");
}

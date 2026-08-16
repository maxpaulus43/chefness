import { z } from "zod";

const modelPriceSchema = z.union([z.string(), z.number()]);

/** Runtime-validated subset of an OpenRouter model used by the model picker. */
export const openRouterModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  architecture: z.object({
    input_modalities: z.array(z.string()).default([]),
  }),
  pricing: z.object({
    prompt: modelPriceSchema,
    completion: modelPriceSchema,
  }),
  supported_parameters: z.array(z.string()).default([]),
});

export type OpenRouterModel = z.infer<typeof openRouterModelSchema>;

/** Shape returned by OpenRouter's public model catalog endpoint. */
export const openRouterModelsResponseSchema = z.object({
  data: z.array(openRouterModelSchema),
});

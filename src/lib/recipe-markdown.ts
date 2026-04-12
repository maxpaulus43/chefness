/**
 * Converts a Recipe object into formatted Markdown text.
 *
 * Pure utility — no React, no side effects.
 */
import type { Recipe } from "@/types/recipe";

/**
 * Format a recipe as a Markdown string suitable for sharing or copying.
 *
 * Output format:
 * ```
 * # Title
 *
 * Description (omitted if empty)
 *
 * ## Ingredients
 *
 * - ingredient 1
 * - ingredient 2
 *
 * ## Steps
 *
 * 1. step 1
 * 2. step 2
 * ```
 */
export function recipeToMarkdown(recipe: Recipe): string {
  const sections: string[] = [];

  // Title
  sections.push(`# ${recipe.title}`);

  // Description (skip if empty)
  if (recipe.description) {
    sections.push(recipe.description);
  }

  // Ingredients
  if (recipe.ingredients.length > 0) {
    const items = recipe.ingredients.map((item) => `- ${item}`).join("\n");
    sections.push(`## Ingredients\n\n${items}`);
  }

  // Steps
  if (recipe.steps.length > 0) {
    const items = recipe.steps
      .map((step, i) => `${i + 1}. ${step}`)
      .join("\n");
    sections.push(`## Steps\n\n${items}`);
  }

  return sections.join("\n\n") + "\n";
}

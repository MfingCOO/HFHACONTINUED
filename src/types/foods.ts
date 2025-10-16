/**
 * @fileOverview This file contains the Zod schemas and TypeScript types
 * for the USDA FoodData Central search tool. Separating these into a
 * dedicated file prevents "use server" module boundary errors.
 *
 * This contract ensures the full, clean data is passed from the
 * backend tool to the frontend component, preventing data loss and
  * calculation discrepancies.
 */

import { z } from 'zod';

// A standardized representation of a single nutrient.
const NutrientSchema = z.object({
  value: z.number(),
  unit: z.string(),
});

// A standardized representation of a single serving size option.
const ServingOptionSchema = z.object({
    // User-friendly label, e.g., "1 Donut (57g)" or "100g"
    label: z.string(),
    // The equivalent weight in grams for this serving option.
    grams: z.number(),
});

// Defines optional attributes that a food can have.
const FoodAttributesSchema = z.object({
  isGlutenFree: z.boolean().optional(),
});
export type FoodAttributes = z.infer<typeof FoodAttributesSchema>;


// The new, comprehensive schema for a food item.
// This is the "single source of truth" for all food data in the app.
export const FoodSchema = z.object({
  fdcId: z.number(),
  description: z.string(),
  brandOwner: z.string().optional(),
  ingredients: z.string().optional(),

  // The food's category from the USDA database, passed through for UPF analysis.
  foodCategory: z.string().optional(),
  
  dataType: z.string().optional(),

  // An array of all possible serving sizes for the UI to use.
  servingOptions: z.array(ServingOptionSchema),

  // A complete key-value map of all nutrients, normalized to a per-100g basis.
  // This allows the UI to reliably calculate nutrition for any selected serving size.
  nutrients: z.record(z.string(), NutrientSchema),
  
  // A score calculated based on the completeness of the data from the USDA API.
  completenessScore: z.number().optional(),

  // A new object to hold boolean flags for various food attributes.
  attributes: FoodAttributesSchema.optional(),
});

export type Food = z.infer<typeof FoodSchema>;

// The output of the food search tool is a structured object to categorize results.
export const FoodSearchOutputSchema = z.object({
    brandedFoods: z.array(FoodSchema),
    foundationFoods: z.array(FoodSchema),
    otherFoods: z.array(FoodSchema),
});
export type FoodSearchOutput = z.infer<typeof FoodSearchOutputSchema>;


// --- MOVED HERE TO BREAK CIRCULAR DEPENDENCY ---
// This schema now lives in the central types file.
export const DetectUpfOutputSchema = z.object({
	score: z.number().describe("A score from 0 (whole food) to 100 (highly ultra-processed)."),
	classification: z.enum(['green', 'yellow', 'red']).describe("A color-coded classification: green for whole/minimally processed, yellow for processed, red for ultra-processed."),
	reasoning: z.string().describe("A concise, one-sentence explanation for the classification.")
});
export type DetectUpfOutput = z.infer<typeof DetectUpfOutputSchema>;


// The final, enriched item returned to the UI is a combination of the food and its UPF analysis.
export const EnrichedFoodItemSchema = z.object({
    food: FoodSchema,
    upf: DetectUpfOutputSchema,
});
export type EnrichedFoodItem = z.infer<typeof EnrichedFoodItemSchema>;

// The final output from the flow to the UI is a simple, flat array of these enriched items.
export const EnrichedFoodSearchOutputSchema = z.array(EnrichedFoodItemSchema);
export type EnrichedFoodSearchOutput = EnrichedFoodItem[];

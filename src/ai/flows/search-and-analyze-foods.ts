
'use server';
/**
 * @fileOverview This file defines a "brain" flow that orchestrates searching for foods
 * and analyzing each one for its UPF (Ultra-Processed Food) rating using a robust,
 * rule-based algorithm based on NOVA and Fardet principles.
 *
 * - searchAndAnalyzeFoods - A function that takes a query, searches for foods,
 * analyzes each one for its UPF value, and returns a single enriched data structure.
 * - EnrichedFoodSearchInput - The input type for the function.
 * - EnrichedFoodSearchOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { searchUsdaFoodDatabase } from '@/ai/tools/search-usda-food-database';
// Import all types from the central types file
import type { Food, FoodSearchOutput, EnrichedFoodItem, EnrichedFoodSearchOutput, DetectUpfOutput } from '@/types/foods';
import { EnrichedFoodSearchOutputSchema } from '@/types/foods';


// Define the input schema for the flow, which now includes the user's unit preference.
const EnrichedFoodSearchInputSchema = z.object({
	query: z.string(),
    units: z.enum(['imperial', 'metric']).default('imperial'),
});
export type EnrichedFoodSearchInput = z.infer<
	typeof EnrichedFoodSearchInputSchema
>;

// --- NEW ROBUST UPF ALGORITHM ---

// Layer 1 Keywords: Based on food name/description
const HIGH_RISK_NAME_TERMS = ['cereal', 'chips', 'soda', 'candy', 'hot dog', 'nuggets', 'ice cream', 'cookie', 'cracker', 'donut', 'muffin', 'cake', 'pancake', 'instant', 'ready-to-eat', 'formula', 'shake', 'bar', 'smartpizza', 'pizza rolls'];

// Layer 2 Keywords: Based on ingredient list
const UPF_INGREDIENT_MARKERS = [
	'emulsifier', 'preservative', 'artificial sweetener', 'artificial color', 'flavor enhancer', 'hydrogenated oil', 'interesterified oil', 'protein isolate', 'modified starch', 'high-fructose corn syrup', 'corn syrup', 'dextrose', 'maltodextrin', 'invert sugar',
	'monosodium glutamate', 'msg', 'hydrolyzed soy protein', 'autolyzed yeast extract', 'carrageenan', 'guar gum', 'xanthan gum', 'sodium nitrite', 'sodium nitrate', 'bht', 'bha', 'tbhq', 'polysorbate'
];
const CULINARY_INGREDIENTS = ['oil', 'butter', 'sugar', 'salt', 'vinegar', 'honey', 'syrup', 'flour'];
const ENRICHED_TERMS = ['enriched', 'fortified'];
const WHOLE_FOOD_TERMS = ['raw', 'fresh', 'steak', 'chicken breast', 'eggs', 'salmon', 'cod', 'tuna', 'nuts', 'apple', 'avocado', 'broccoli', 'banana', 'orange', 'spinach', 'beef', 'pork chop', 'potato', 'tomato'];


// Layer 3 Keywords: Based on food category
const HIGH_RISK_CATEGORIES = ['Baked Products', 'Snacks', 'Fast Foods', 'Sausages and Luncheon Meats', 'Desserts', 'Breakfast Cereals', 'Baby Foods', 'Soups', 'Sauces and Gravies', 'Beverages'];


function runUpfAlgorithm(food: Food): DetectUpfOutput {
	let score = 0;
	let reasons: string[] = [];
	const lowerCaseDesc = food.description.toLowerCase();
    const lowerCaseIngredients = food.ingredients?.toLowerCase() || '';
	const ingredients = lowerCaseIngredients.split(/, |\(|\)/).map(i => i.trim());

	// --- Refinement 3: Synthetic vs. Natural Ingredient Split ---
	// Start by giving a baseline score based on natural vs synthetic ingredients.
	const naturalMarkersFound = WHOLE_FOOD_TERMS.filter(term => lowerCaseIngredients.includes(term));
	const syntheticMarkersFound = UPF_INGREDIENT_MARKERS.filter(marker => lowerCaseIngredients.includes(marker));

	score += syntheticMarkersFound.length * 20;
	score -= naturalMarkersFound.length * 10;
	if (syntheticMarkersFound.length > 0) reasons.push(`Contains synthetic ingredients like ${syntheticMarkersFound[0]}`);

	// --- Layer 1: Name-Based Heuristics ---
	if (HIGH_RISK_NAME_TERMS.some(term => lowerCaseDesc.includes(term))) {
		score += 30;
		reasons.push("Product name suggests it is typically ultra-processed.");
	}

	// --- Layer 2: Ingredient Analysis ---
	if (food.ingredients) {
		// Refinement 1: Ingredient Order Dominance
		const firstThreeIngredients = ingredients.slice(0, 3).join(' ');
        if (CULINARY_INGREDIENTS.some(term => firstThreeIngredients.includes(term))) {
             score += 25;
             reasons.push("Primary ingredients are sugar, oil, or fat.");
        }

		// Refinement 2: Enrichment/Fortification Flag
		if (ENRICHED_TERMS.some(term => lowerCaseIngredients.includes(term))) {
			score += 15;
			reasons.push("Is 'enriched' or 'fortified', indicating prior stripping of nutrients.");
		}
	} else {
		// If a multi-ingredient food lacks an ingredients list, it's a red flag.
		if (!WHOLE_FOOD_TERMS.some(term => lowerCaseDesc.includes(term))) {
			score += 25;
			reasons.push("Lacks an ingredient list, which is common for processed foods.");
		}
	}

	// --- Layer 3: Category and Commercial Context ---
	if (food.foodCategory && HIGH_RISK_CATEGORIES.some(cat => food.foodCategory!.includes(cat))) {
		score += 20;
		reasons.push("Belongs to a high-risk food category.");
	}
	// Refinement 4: Branded DataType Penalty
	if (food.dataType === 'Branded') {
		score += 10;
		reasons.push("Is a commercially branded product.");
	}
	
	// --- Layer 4: Nutrient Profile Scoring ---
    const nutrients = food.nutrients || {};
    const sugar = nutrients['Sugars, total including NLEA']?.value || nutrients['Sugars, added']?.value || 0;
    const sodium = nutrients['Sodium, Na']?.value || 0;
    const fiber = nutrients['Fiber, total dietary']?.value || 0;
	// These values are per 100g. A typical serving is ~30-50g, so we adjust thresholds.
    if (sugar > 20) { // >20g per 100g is very high
        score += 10;
        reasons.push("High in sugar.");
    }
    if (sodium > 1000) { // >1000mg per 100g is very high
        score += 10;
        reasons.push("High in sodium.");
    }
    if (fiber < 1) { // <1g per 100g is very low
        score += 5;
        reasons.push("Low in fiber.");
    }

	// --- Final Score Calculation & Classification ---
	score = Math.max(0, Math.min(100, score));

	// Using the new, tighter thresholds
	let classification: 'green' | 'yellow' | 'red';
	if (score < 10) classification = 'green';
	else if (score >= 10 && score < 20) classification = 'yellow';
	else classification = 'red';

	// Final override for clear whole foods that might have been penalized
	const isSingleIngredientWholeFood = WHOLE_FOOD_TERMS.some(term => lowerCaseDesc.includes(term)) && ingredients.length <= 1;
	if (isSingleIngredientWholeFood) {
		score = 0;
		classification = 'green';
		reasons = ["Considered a single-ingredient whole food."];
	}
	
	return {
		score: Math.round(score),
		classification,
		reasoning: reasons.length > 0 ? reasons[0] : "Analyzed based on its ingredients and category.",
	};
}
// --- End of Algorithm ---


// This is the exported function the frontend will call.
export async function searchAndAnalyzeFoods(
	input: EnrichedFoodSearchInput
): Promise<EnrichedFoodSearchOutput> {
	return searchAndAnalyzeFoodsFlow(input);
}

const searchAndAnalyzeFoodsFlow = ai.defineFlow(
	{
		name: 'searchAndAnalyzeFoodsFlow',
		inputSchema: EnrichedFoodSearchInputSchema,
		outputSchema: EnrichedFoodSearchOutputSchema,
	},
	async ({ query, units }) => {
		// 1. Get the raw, structured food search results from the USDA tool.
		let searchResults: FoodSearchOutput;
		try {
			// Call the tool, passing the user's unit preference.
			searchResults = await searchUsdaFoodDatabase({ query, units });
		} catch (error: any) {
			if (error.message === 'API_KEY_IS_THE_ISSUE') {
				console.warn('USDA API Key is missing. Returning empty search results.');
				return [];
			}
			// Re-throw other unexpected errors.
			throw error;
		}

		if (!searchResults) {
			return [];
		}

		// 2. Helper function to process a list of foods.
		const analyzeFoodList = (foods: Food[]): EnrichedFoodItem[] => {
			return foods.map((food) => {
				let upfAnalysis: DetectUpfOutput;
				try {
					// Run the robust, self-contained algorithm on each food.
					upfAnalysis = runUpfAlgorithm(food);
				} catch (e) {
					console.error("Critical Error in UPF Algorithm for food:", food.description, e);
					// If the algorithm fails, create a "failsafe" object.
					upfAnalysis = {
						score: 50, // Default to a medium-high score on error
						classification: 'yellow',
						reasoning: "Could not fully analyze food data as the UPF algorithm encountered an error.",
					};
				}
				return { food, upf: upfAnalysis };
			});
		};

		// 3. Apply the UPF algorithm to each category of foods.
		const branded = analyzeFoodList(searchResults.brandedFoods);
		const foundation = analyzeFoodList(searchResults.foundationFoods);
		const other = analyzeFoodList(searchResults.otherFoods);

		// --- NEW: INTELLIGENT SORTING ---
		// Combine all results into a single array.
		const allResults = [...branded, ...foundation, ...other];
		
		allResults.sort((a, b) => {
			// Primary sort: by completeness score (higher is better)
			const scoreA = a.food.completenessScore || 0;
			const scoreB = b.food.completenessScore || 0;
			if (scoreA !== scoreB) {
				return scoreB - scoreA;
			}
			
			// Secondary sort: by UPF score (lower is better)
			return a.upf.score - b.upf.score;
		});

		return allResults;
	}
);

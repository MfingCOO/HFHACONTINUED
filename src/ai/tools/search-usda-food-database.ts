
'use server';
/**
 * @fileOverview This file defines a Genkit tool for searching the USDA FoodData Central database.
 * It provides a structured interface for querying food data and returning it in a standardized format.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import {Food, FoodSchema, FoodSearchOutput, FoodSearchOutputSchema, FoodAttributes} from '@/types/foods';
import { USDA_PORTION_OVERRIDES } from '@/data/usda-portion-overrides';

// --- NEW: Keyword lists for title-based scoring ---
const KEYWORD_SCORES = {
    // Tier 1: Complete Units (Highest Score)
    WHOLE: 50, ONE: 50, SINGLE: 50, ENTIRE: 50,
    // Tier 2: Physical Portions
    SLICE: 40, PIECE: 40, CHUNK: 40, PATTY: 40, FILLET: 40, FILET: 40, LOIN: 40,
    STEAK: 40, CHOP: 40, DRUMSTICK: 40, WING: 40, BREAST: 40, THIGH: 40,
    LINK: 40, POD: 40, KERNEL: 40, CLOVE: 40,
    // Tier 3: Size Qualifiers
    SMALL: 30, MEDIUM: 30, LARGE: 30, 'EXTRA LARGE': 30, JUMBO: 30,
    // Tier 4: State/Form
    EAR: 20, CAN: 20, BOTTLE: 20, CONTAINER: 20,
};

// Define the input schema for the tool. It now accepts the user's preferred unit system.
const FoodSearchInputSchema = z.object({
	query: z.string(),
    units: z.enum(['imperial', 'metric']).default('imperial'),
});

export const searchUsdaFoodDatabase = ai.defineTool(
	{
		name: 'searchUsdaFoodDatabase',
		description: 'Searches the USDA FoodData Central database for food items.',
		inputSchema: FoodSearchInputSchema,
		outputSchema: FoodSearchOutputSchema, // Output is now the structured schema
	},
	async ({query, units}) => {
		
		if (!process.env.USDA_API_KEY) {
			console.error("CRITICAL ERROR: USDA_API_KEY is not set in environment variables.");
			throw new Error('API_KEY_IS_THE_ISSUE');
		}

		const apiKey = process.env.USDA_API_KEY;
		const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(
			query
		)}&dataType=Branded,Foundation,SR%20Legacy&pageSize=50`;

		try {
			const response = await fetch(url);
			if (!response.ok) {
				console.error(`USDA API Error: ${response.status} ${response.statusText}`);
				// Return an empty structured object on API errors.
				return { brandedFoods: [], foundationFoods: [], otherFoods: [] };
			}

			const data = await response.json();
			
			const foods: Food[] = data.foods
				.map((food: any): Food | null => {
					
					// Nutrient parsing logic
					const nutrients = (food.foodNutrients || []).reduce(
						(acc: Record<string, {value: number; unit: string}>, nutrient: any) => {
							if (nutrient.nutrientName && nutrient.value !== undefined) {
								if (nutrient.nutrientName === 'Energy' && nutrient.unitName !== 'KCAL') {
									return acc;
								}
								acc[nutrient.nutrientName] = {
									value: nutrient.value,
									unit: nutrient.unitName?.toLowerCase() || '',
								};
							}
							return acc;
						},
						{}
					);
					
                    // --- REWRITTEN & CORRECTED: ROBUST SERVING SIZE SELECTION LOGIC ---
                    const allPortions: {label: string, grams: number}[] = [];
                    const seenLabels = new Set<string>();

                    const addUniquePortion = (label: string | undefined | null, grams: number | undefined | null) => {
                        if (!label || !grams || grams <= 0) return;
                        const lowerLabel = label.toLowerCase();
                        if (!seenLabels.has(lowerLabel)) {
                            allPortions.push({ label, grams });
                            seenLabels.add(lowerLabel);
                        }
                    };

                    // 1. Check for hardcoded overrides first
                    if (USDA_PORTION_OVERRIDES[food.fdcId]) {
                        USDA_PORTION_OVERRIDES[food.fdcId].forEach(override => {
                            addUniquePortion(override.portionDescription, override.gramWeight);
                        });
                    }

                    // 2. Add all household portions from the `foodPortions` array.
                    if (food.foodPortions && food.foodPortions.length > 0) {
                        food.foodPortions.forEach((portion: any) => {
                            const label = portion.portionDescription || portion.modifier || `${portion.amount} ${portion.measureUnit?.name || 'g'}`;
                            addUniquePortion(label, portion.gramWeight);
                        });
                    }

                    // 3. Add the base `servingSize` as a fallback, creating a user-friendly label.
                    if (food.servingSize && food.servingSizeUnit) {
                        addUniquePortion(`${food.servingSize} ${food.servingSizeUnit}`, food.servingSize * (food.servingSizeUnit.toLowerCase() === 'oz' ? 28.35 : 1));
                    }

                    // 4. Always add 100g and its ounce equivalent for universal standards.
                    addUniquePortion('100g', 100);
                     if (units === 'imperial') {
                        addUniquePortion('3.5 oz', 100);
                    }
					
					// 5. Enhanced Sorting with Keyword Weighting, as per your instructions
					const portionKeywords: Record<string, number> = {
						'whole': 50, 'egg': 50, 'apple': 50, 'piece': 40, 'slice': 40, 'fillet': 40, 'steak': 40,
						'chop': 40, 'drumstick': 40, 'wing': 40, 'breast': 40, 'thigh': 40, 'link': 40, 'patty': 40, 'roll': 40, 'pita': 40, 'large': 20, 'medium': 20, 'small': 20,
						'serving': -5, 'cup': -10, 'oz': -10, 'g': -15 
					};
					
					allPortions.sort((a, b) => {
                        const aScore = Object.entries(portionKeywords).reduce((sum, [keyword, score]) => 
                            a.label.toLowerCase().includes(keyword) ? sum + score : sum, 0);
                        const bScore = Object.entries(portionKeywords).reduce((sum, [keyword, score]) => 
                            b.label.toLowerCase().includes(keyword) ? sum + score : sum, 0);
                        
                        // Primary sort by score (descending)
                        if (bScore !== aScore) {
                            return bScore - aScore;
                        }
                        // Tiebreaker by gram weight (ascending) to prefer single items
                        return a.grams - b.grams; 
					});

                    // 6. Construct the final `servingOptions` array from the sorted list.
                    const servingOptions = allPortions.map(({ label, grams }) => ({ label, grams }));


					if (!nutrients['Energy'] || servingOptions.length === 0) {
						return null;
					}

                    // --- INTELLIGENT COMPLETENESS SCORE ---
                    let completenessScore = 0;
                    const lowerCaseDescription = food.description.toLowerCase();
                    for (const keyword in KEYWORD_SCORES) {
                        if (lowerCaseDescription.includes(keyword.toLowerCase())) {
                            completenessScore += KEYWORD_SCORES[keyword as keyof typeof KEYWORD_SCORES];
                        }
                    }
					if (food.foodPortions && food.foodPortions.length > 0) {
                        completenessScore += 20;
                    }
					if (food.dataType === 'SR Legacy' || food.dataType === 'Foundation') {
						completenessScore += 15;
					} else if (food.dataType === 'Branded') {
						completenessScore -= 5;
					}


					const attributes: FoodAttributes = {};
					const lowerCaseIngredients = food.ingredients?.toLowerCase() || '';
					const containsGlutenFreeLabel = lowerCaseDescription.includes('gluten free') || lowerCaseDescription.includes('gluten-free');
					const containsWheat = lowerCaseIngredients.includes('wheat');
					if (containsGlutenFreeLabel) {
						attributes.isGlutenFree = true;
					} else if (containsWheat) {
						attributes.isGlutenFree = false;
					}

					return {
						fdcId: food.fdcId,
						description: food.description,
						brandOwner: food.brandOwner,
						ingredients: food.ingredients,
						foodCategory: food.foodCategory,
						dataType: food.dataType,
						servingOptions, // The intelligently sorted array
						nutrients,
						attributes,
						completenessScore,
					};
				})
				.filter((food: Food | null): food is Food => food !== null);
			
			const result: FoodSearchOutput = foods.reduce(
				(acc, food) => {
					if (food.dataType === 'Branded') {
						acc.brandedFoods.push(food);
					} else if (food.dataType === 'Foundation') {
						acc.foundationFoods.push(food);
					} else {
						acc.otherFoods.push(food);
					}
					return acc;
				}, 
				{ brandedFoods: [], foundationFoods: [], otherFoods: [] } as FoodSearchOutput
			);

			return result;
		} catch (error: any) {
			console.error('Failed to fetch or process USDA food data:', error);
			return { brandedFoods: [], foundationFoods: [], otherFoods: [] };
		}
	}
);

    
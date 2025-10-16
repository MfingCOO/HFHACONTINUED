
'use server';
/**
 * @fileOverview This file defines a Genkit flow for analyzing a user's daily nutritional intake.
 *
 * - analyzeDailyNutrition - A function that takes a summary of daily nutrients and returns a single, actionable insight.
 * - AnalyzeDailyNutritionInput - The input type for the function.
 * - AnalyzeDailyNutritionOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { rda } from '@/lib/rda';

const AnalyzeDailyNutritionInputSchema = z.object({
  nutrientSummary: z.string().describe("A JSON string representing the user's total nutrient intake for the day."),
  clientInfo: z.object({
      sex: z.string(),
      age: z.number(),
      weightKg: z.number(),
  }).describe("Basic client info for personalizing recommendations.")
});
export type AnalyzeDailyNutritionInput = z.infer<typeof AnalyzeDailyNutritionInputSchema>;

const AnalyzeDailyNutritionOutputSchema = z.object({
    title: z.string().describe("A short, encouraging title for the insight (e.g., 'A Focus on Magnesium')."),
    finding: z.string().describe("A one-sentence description of the single most significant nutritional gap or surplus for the day."),
    explanation: z.string().describe('The "why" behind the finding, using the provided context to explain the health benefit in simple terms.'),
    suggestion: z.string().describe('A simple, concrete, actionable food-based suggestion for the next day to address the finding.'),
});
export type AnalyzeDailyNutritionOutput = z.infer<typeof AnalyzeDailyNutritionOutputSchema>;


const suggestionBank: Record<string, string> = {
    'Magnesium, Mg': "Try adding a handful of almonds or a side of spinach to one of your meals tomorrow.",
    'Vitamin D (D2 + D3)': "Consider getting some morning sunlight, or add a food like salmon or fortified milk to your diet.",
    'Fiber, total dietary': "A great way to boost fiber is with a serving of beans, lentils, or a bowl of oatmeal.",
    'Potassium, K': "Bananas and avocados are excellent sources of potassium to help you reach your goal.",
    'UPF Score': "Try swapping one processed snack for a piece of whole fruit or a handful of nuts.",
    'Default': "Focus on incorporating a variety of colorful vegetables into your meals tomorrow."
};


export async function analyzeDailyNutrition(input: AnalyzeDailyNutritionInput): Promise<AnalyzeDailyNutritionOutput> {
    const { nutrientSummary, clientInfo } = input;
    const summary = JSON.parse(nutrientSummary);

    const userNutrients = summary.allNutrients || {};
    let upfScore = summary.upf;
    
    let biggestGap = { key: '', ratio: 0, isDeficit: true };

    // Priority Check: If UPF score is high, it's the most important insight.
    if (upfScore > 40) {
         return {
            title: 'Focus on Whole Foods',
            finding: `Your average UPF score of ${upfScore.toFixed(0)}% was higher than the ideal goal.`,
            explanation: "Ultra-processed foods can disrupt hunger signals and contribute to inflammation. Reducing them helps restore your body's natural balance.",
            suggestion: suggestionBank['UPF Score']
        };
    }
    
    // Algorithm to find the biggest nutrient gap
    for (const key in rda) {
        if (key === 'Energy' || key.includes('Omega') || key === 'Sugars, added' || key === 'Protein') continue; // Skip complex or non-essential for this insight

        const rdaValue = rda[key].value;
        const userValue = userNutrients[key]?.value || 0;
        
        if (rdaValue > 0 && userValue > 0) {
            const ratio = userValue / rdaValue;
             // We care most about deficits. Find the nutrient where the user has consumed the smallest fraction of their goal.
            if (ratio < 1) {
                 const deficitRatio = 1 - ratio; // How far from 100% they are
                 if(deficitRatio > biggestGap.ratio) {
                     biggestGap = { key, ratio: deficitRatio, isDeficit: true };
                 }
            }
        }
    }

    if (!biggestGap.key) {
        return {
            title: 'Great Job on Your Nutrients!',
            finding: "You did a great job balancing your nutrients today based on the data logged.",
            explanation: "Consistent nutrient intake is key to stable energy and mood. Keep up the fantastic work!",
            suggestion: "Try exploring a new healthy recipe tomorrow to keep things interesting!"
        };
    }

    const nutrientKey = biggestGap.key;
    const nutrientInfo = rda[nutrientKey];
    const finding = `I noticed your ${nutrientKey.split(',')[0]} intake was lower than the optimal goal today.`;

    return {
        title: `A Focus on ${nutrientKey.split(',')[0]}`,
        finding: finding,
        explanation: nutrientInfo.description || "This nutrient is important for overall health and wellness.",
        suggestion: suggestionBank[nutrientKey] || suggestionBank['Default'],
    };
}

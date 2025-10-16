
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating personalized wellness insights.
 *
 * - generateInsight - A function that takes a history of user data and returns an AI-powered insight.
 * - GenerateInsightInput - The input type for the generateInsight function.
 * - GenerateInsightOutput - The return type for the generateInsight function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';

const GenerateInsightInputSchema = z.object({
  history: z.string().describe('A JSON string representing the user\'s logged data for a specific period.'),
  periodInDays: z.number().describe('The number of days the history covers (e.g., 3, 7, 21).'),
});
export type GenerateInsightInput = z.infer<typeof GenerateInsightInputSchema>;

const GenerateInsightOutputSchema = z.object({
    title: z.string().describe("A catchy, positive title for the insight (e.g., 'Sleep is Your Superpower!')."),
    pattern: z.string().describe('The single most important positive or negative pattern, trend, or correlation discovered in the data.'),
    explanation: z.string().describe('The biological "why" behind the pattern, explaining the mechanism in simple, encouraging terms (e.g., how sleep affects ghrelin/leptin).'),
    suggestion: z.string().describe('A simple, actionable suggestion or a celebratory affirmation based on the insight.'),
});
export type GenerateInsightOutput = z.infer<typeof GenerateInsightOutputSchema>;

export async function generateInsight(input: GenerateInsightInput): Promise<GenerateInsightOutput> {
  return generateInsightFlow(input);
}

const generateInsightFlow = ai.defineFlow(
  {
    name: 'generateInsightFlow',
    inputSchema: GenerateInsightInputSchema,
    outputSchema: GenerateInsightOutputSchema,
  },
  async input => {
    const settings = await getSiteSettingsAction();
    // Force the app to use the model set in the coach's settings.
    // If it's not set, it should fail clearly.
    const modelName = settings.data?.aiModelSettings?.flash;

    if (!modelName) {
      throw new Error("The 'Flash' AI model has not been configured in the site settings. Please ask the coach to set it.");
    }
    
    console.log(`Using AI model for generateInsightFlow: ${modelName}`);
    
    const { output } = await ai.generate({
      model: modelName,
      prompt: `You are an AI wellness coach for the "Hunger Free and Happy" app. Your goal is to analyze a user's data for the last ${input.periodInDays} days to find the single most impactful pattern and explain it in a way that is educational, motivational, and free of judgment, based on the book's philosophy.
  
Core Philosophy: Focus on celebrating progress and framing challenges as learning opportunities. Explain the biological "why" behind habits (e.g., hormone balance, metabolism, gut health). Connect actions to the feeling of being "hunger-free and happy." Avoid language of restriction, failure, or guilt.

Your Task:
1. Analyze the provided JSON data of the user's logs.
2. Identify the single most important pattern. This could be a positive synergy (e.g., good sleep + hydration led to fewer cravings) or a learning opportunity (e.g., high stress correlated with eating more ultra-processed food).
3. Create a response in the required JSON format with the following fields:
- title: A short, encouraging, and positive title for the insight.
- pattern: A one-sentence description of the pattern you found.
- explanation: Simply and clearly explain the biological reason ("the why") for this pattern. Connect it to hormones (ghrelin, leptin, cortisol), energy levels, or mood.
- suggestion: Offer a simple, actionable tip if it's a learning opportunity, or a powerful affirmation if it's a positive pattern.
`,
      context: [
        { role: 'user', content: `Here is the user's data to analyze:\n\n${input.history}` }
      ],
      output: {
        format: 'json',
        schema: GenerateInsightOutputSchema,
      },
    });

    if (!output) {
      throw new Error('The AI failed to generate a valid insight.');
    }

    return output;
  }
);

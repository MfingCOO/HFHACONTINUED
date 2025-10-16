
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating population-level wellness insights.
 *
 * - generatePopulationInsight - A function that takes aggregate data and returns AI-powered insights for coaches.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';

// The input is now a structured object of aggregated statistics, not just a JSON string.
const PopulationInsightInputSchema = z.object({
  aggregateData: z.object({
    totalClients: z.number(),
    averageSleep: z.number().nullable(),
    averageUpfScore: z.number().nullable(),
    averageActivityMinutes: z.number().nullable(),
    totalCravingsLast7Days: z.number(),
    totalBingesLast7Days: z.number(),
    totalStressEventsLast7Days: z.number(),
  }),
  period: z.enum(['daily', 'weekly', 'monthly']).describe('The time period the data covers.'),
});
export type PopulationInsightInput = z.infer<typeof PopulationInsightInputSchema>;

const PopulationInsightOutputSchema = z.object({
    finding: z.string().describe('The single most important pattern, trend, or correlation discovered in the aggregate data. Be specific and use the data provided.'),
    explanation: z.string().describe('The likely "why" behind the pattern, explained in simple, biological, or psychological terms relevant to the Hunger Free & Happy philosophy.'),
    suggestion: z.string().describe('A concrete, actionable suggestion for coaches to address this trend. What should they do next?'),
});
export type PopulationInsightOutput = z.infer<typeof PopulationInsightOutputSchema>;

export async function generatePopulationInsight(input: PopulationInsightInput): Promise<PopulationInsightOutput> {
  return generatePopulationInsightFlow(input);
}

const generatePopulationInsightFlow = ai.defineFlow(
  {
    name: 'generatePopulationInsightFlow',
    inputSchema: PopulationInsightInputSchema,
    outputSchema: PopulationInsightOutputSchema,
  },
  async ({ aggregateData, period }) => {
    const settings = await getSiteSettingsAction();
    const modelName = settings.data?.aiModelSettings?.pro;
    
    if (!modelName) {
      throw new Error("The 'Pro' AI model has not been configured in the site settings. Please ask the coach to set it.");
    }
    console.log(`Using AI model for generatePopulationInsightFlow: ${modelName}`);
    
    // Stringify the data in the code, not in the template.
    const dataString = JSON.stringify(aggregateData, null, 2);
    
    const {output} = await ai.generate({
        model: modelName,
        prompt: `You are an expert data analyst for the "Hunger Free and Happy" wellness app. Your mission is to analyze aggregated, anonymized data from the entire user population over the past ${period} and identify the single most impactful insight for the coaching team.

  **Core Philosophy:** Focus on actionable intelligence. What is the one pattern that, if addressed, could provide the most benefit to the community? Connect behaviors to outcomes based on the app's principles (e.g., sleep impacts hormones, UPF impacts cravings).

  **Your Task:**
  1.  Analyze the provided JSON object of aggregate user data.
  2.  Identify the **single most important pattern, trend, or correlation**. This is not just about reporting a number, but about finding a connection. For example, don't just say "average sleep was 6.5 hours." Instead, find a connection: "The low average sleep of 6.5 hours likely contributed to the high number of cravings logged."
  3.  Formulate a concise 'finding', a clear 'explanation' for why it's happening, and an actionable 'suggestion' for the coaches.

  Generate the single most important, actionable insight for the coaching team.
  `,
        context: [
            { role: 'user', content: `Aggregate User Data to Analyze:\n\n${dataString}` }
        ],
        output: {
            format: 'json',
            schema: PopulationInsightOutputSchema,
        },
    });
    
    if (!output) {
      throw new Error("The AI failed to generate a valid insight.");
    }

    return output;
  }
);

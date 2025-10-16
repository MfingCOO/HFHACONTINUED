
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a real-time, encouraging insight when a user completes a challenge task.
 *
 * - generateChallengeInsight - A function that takes contextual data and returns an AI-powered insight.
 * - GenerateChallengeInsightInput - The input type for the function.
 * - GenerateChallengeInsightOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateChallengeInsightInputSchema = z.object({
  taskDescription: z.string().describe('The description of the task the user just completed.'),
  streakCount: z.number().describe('The number of consecutive days the user has completed this task.'),
  clientName: z.string().describe('The first name of the client.'),
});
export type GenerateChallengeInsightInput = z.infer<typeof GenerateChallengeInsightInputSchema>;

const GenerateChallengeInsightOutputSchema = z.object({
    title: z.string().describe("A short, celebratory, and encouraging title for the insight (e.g., 'Way to Go!', 'Consistency is Key!')."),
    message: z.string().describe('A one or two-sentence message that celebrates the achievement, explains the benefit, and connects it to the "Hunger Free and Happy" philosophy. It should be positive and empowering.'),
});
export type GenerateChallengeInsightOutput = z.infer<typeof GenerateChallengeInsightOutputSchema>;

export async function generateChallengeInsight(input: GenerateChallengeInsightInput): Promise<GenerateChallengeInsightOutput> {
  return generateChallengeInsightFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateChallengeInsightPrompt',
  input: {schema: GenerateChallengeInsightInputSchema},
  output: {schema: GenerateChallengeInsightOutputSchema},
  system: `You are an AI wellness coach for the "Hunger Free and Happy" app. Your goal is to provide immediate, positive reinforcement when a user completes a challenge task.
  
Core Philosophy: Frame every action as a success. Focus on the 'why' behind the habit. Explain the biological or psychological benefit in simple, encouraging terms. Your tone should be celebratory, friendly, and supportive, never clinical or demanding.

Your Task:
1. Analyze the provided data about the user's completed task and their current streak.
2. Craft a response in the required JSON format with two fields:
- title: A short, exciting title.
- message: A 1-2 sentence message. If the streak is 1, focus on getting started. If the streak is greater than 1, praise the consistency and explain its compounding benefit.

Example for a 1-day streak on a hydration task:
- Title: "Great Start, {{{clientName}}}!"
- Message: "You've taken the first step! Every sip of water is a vote for better energy and clearer hunger signals today."

Example for a 3-day streak on a hydration task:
- Title: "Awesome Consistency!"
- Message: "That's 3 days in a row! Consistent hydration helps regulate hunger hormones like ghrelin, making it easier to feel satisfied and in control."
`,
  prompt: `The user, {{{clientName}}}, has just completed a task. Here is the context:

- Task Completed: "{{{taskDescription}}}"
- Current Streak: {{{streakCount}}} days

Generate a new, unique, and motivating insight based on this information.
`,
});

const generateChallengeInsightFlow = ai.defineFlow(
  {
    name: 'generateChallengeInsightFlow',
    inputSchema: GenerateChallengeInsightInputSchema,
    outputSchema: GenerateChallengeInsightOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);


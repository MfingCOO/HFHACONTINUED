'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting healthy alternatives to food cravings or unhealthy choices.
 *
 * - suggestHealthyAlternatives - A function that takes a food craving or unhealthy choice as input and suggests healthy alternatives.
 * - SuggestHealthyAlternativesInput - The input type for the suggestHealthyAlternatives function.
 * - SuggestHealthyAlternativesOutput - The return type for the suggestHealthyAlternatives function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestHealthyAlternativesInputSchema = z.object({
  craving: z.string().describe('The food craving or unhealthy choice the user wants a healthy alternative for.'),
});
export type SuggestHealthyAlternativesInput = z.infer<typeof SuggestHealthyAlternativesInputSchema>;

const SuggestHealthyAlternativesOutputSchema = z.object({
  alternatives: z.array(z.string()).describe('An array of healthy alternatives for the craving.'),
  reasoning: z.string().describe('The reasoning behind why these alternatives are healthier.'),
});
export type SuggestHealthyAlternativesOutput = z.infer<typeof SuggestHealthyAlternativesOutputSchema>;

export async function suggestHealthyAlternatives(input: SuggestHealthyAlternativesInput): Promise<SuggestHealthyAlternativesOutput> {
  return suggestHealthyAlternativesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestHealthyAlternativesPrompt',
  input: {schema: SuggestHealthyAlternativesInputSchema},
  output: {schema: SuggestHealthyAlternativesOutputSchema},
  prompt: `You are a nutritionist who suggests healthy alternatives to unhealthy food cravings.

  The user is craving: {{{craving}}}

  Suggest at least 3 healthy alternatives, and explain why they are healthier choices.

  Format your response as a JSON object with "alternatives" and "reasoning" fields. The "alternatives" field should be an array of strings.
  `,
});

const suggestHealthyAlternativesFlow = ai.defineFlow(
  {
    name: 'suggestHealthyAlternativesFlow',
    inputSchema: SuggestHealthyAlternativesInputSchema,
    outputSchema: SuggestHealthyAlternativesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);


'use server';
/**
 * @fileOverview This is the master "brain" for generating personalized insights.
 * This flow takes a comprehensive look at a user's data across all pillars for a
 * given period, correlates it with the expert knowledge in the 'library' collection,
 * and produces a single, high-impact, actionable insight.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db } from '@/lib/firebaseAdmin';
import { getAllDataForPeriod } from '@/services/firestore';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';

// Define the input schema for the flow.
const GenerateHolisticInsightInputSchema = z.object({
  userId: z.string().describe('The UID of the user for whom to generate the insight.'),
  periodInDays: z.number().describe('The number of days of history to analyze (e.g., 3, 7, 30).'),
  triggeringEvent: z.string().optional().describe('Optional: A JSON string of a specific event (like a craving or binge log) that prompted this insight generation. This helps focus the analysis.'),
});
export type GenerateHolisticInsightInput = z.infer<typeof GenerateHolisticInsightInputSchema>;

// Define the structured output the AI must produce.
const GenerateHolisticInsightOutputSchema = z.object({
  title: z.string().describe("A short, engaging title for the insight (e.g., 'The Sleep-Craving Connection')."),
  pattern: z.string().describe('A simple, one-sentence description of the most significant pattern or correlation found in the user\'s data.'),
  explanation: z.string().describe('A clear explanation of the biological or psychological "why" behind the pattern, using principles from the provided library documents.'),
  suggestion: z.string().describe('A single, concrete, and actionable suggestion the user can implement to improve.'),
});
export type GenerateHolisticInsightOutput = z.infer<typeof GenerateHolisticInsightOutputSchema>;


// Exported function that the application will call.
export async function generateHolisticInsight(input: GenerateHolisticInsightInput): Promise<GenerateHolisticInsightOutput> {
  return generateHolisticInsightFlow(input);
}


// Define the main flow that orchestrates the data fetching and AI call.
const generateHolisticInsightFlow = ai.defineFlow(
  {
    name: 'generateHolisticInsightFlow',
    inputSchema: GenerateHolisticInsightInputSchema,
    outputSchema: GenerateHolisticInsightOutputSchema,
  },
  async ({ userId, periodInDays, triggeringEvent }) => {
    // 1. Fetch all user data for the specified period.
    const historyResult = await getAllDataForPeriod(periodInDays, userId);
    if (!historyResult.success) {
      throw new Error(`Failed to fetch user history: ${historyResult.error}`);
    }

    if (!historyResult.data || historyResult.data.length === 0) {
        // Return a gentle, actionable default insight if there's no data
        return {
            title: "A Moment for Self-Compassion",
            pattern: "It's okay to have setbacks. What matters most is how we respond.",
            explanation: "This is a single data point, not a definition of your journey. Acknowledge the moment, be kind to yourself, and let it go.",
            suggestion: "Let's reset. Take a few deep breaths, drink a glass of water, and remember that your next choice is a new opportunity."
        };
    }
    
    const userHistory = JSON.stringify(historyResult.data, null, 2);

    // 2. Fetch all content from the knowledge library.
    const librarySnapshot = await db.collection('library').get();
    let libraryContent = "No library documents found.";
    if (!librarySnapshot.empty) {
      libraryContent = librarySnapshot.docs
        .map(doc => `Document: ${doc.data().name}\nContent: ${doc.data().text}\n---`)
        .join('\n\n');
    }
    
    // 3. Get the model name directly from settings. No fallback.
    const settings = await getSiteSettingsAction();
    const modelName = settings.data?.aiModelSettings?.pro;
    if (!modelName) {
        throw new Error("The 'Pro' AI model has not been configured in the site settings. Please ask the coach to set it.");
    }
    console.log(`Using AI model for generateHolisticInsightFlow: ${modelName}`);

    // 4. Call the AI model with the combined data.
    const { output } = await ai.generate({
      model: modelName, // Use the model name directly.
      prompt: `You are an expert wellness coach. Your goal is to analyze a user's data and expert knowledge to find the single most impactful, non-obvious pattern.

Core Philosophy:
- Your tone is educational, empathetic, and encouraging. You never use shame or guilt.
- **Crucially, do not mention "the app," "the book," or "the library" in your response.** State principles directly as an expert. Your advice should feel personal and direct, not like a machine quoting its sources.
- Frame suggestions as gentle recommendations (e.g., "It might be helpful to...", "Consider focusing on...").

Your Task:
1.  **Analyze the User's Data:** Review the provided user logs. Look for correlations across all pillars (sleep, nutrition, stress, etc.).
2.  **Consult the Knowledge Base:** Review the provided expert content.
3.  **Synthesize and Explain:** Connect the pattern from the user's data with a principle from the knowledge base. You MUST explain the 'why' behind the pattern using the library's information, but state it as a fact.
4.  **Handle Insufficient Data:** If the user history is sparse or no clear pattern emerges, do not invent one. Instead, identify a foundational principle from the library and provide a gentle, educational tip about it.
5.  **Formulate Response:** Create a response in the required JSON format (title, pattern, explanation, suggestion).
`,
      context: [
        { role: 'user', content: `Here is the user's data from the last ${periodInDays} days:\n\n${userHistory}`},
        { role: 'user', content: `Here is the expert content from the app's library:\n\n${libraryContent}`},
        ...(triggeringEvent ? [{ role: 'user', content: `The user just logged this specific event, which should be the focus of your analysis:\n\n${triggeringEvent}`}] : []),
      ],
      output: {
        format: 'json',
        schema: GenerateHolisticInsightOutputSchema,
      },
    });

    if (!output) {
      throw new Error("The AI failed to generate a valid insight.");
    }
    
    return output;
  }
);

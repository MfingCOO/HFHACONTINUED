
'use server';
/**
 * @fileOverview A Genkit flow that acts as a powerful analysis tool for coaches.
 * It allows a coach to ask a specific question about a client, and the AI will
 * analyze that client's data in the context of the entire knowledge library to provide an answer.
 *
 * - askLibrary - A function that takes a client's UID and a question, returning an AI-powered analysis.
 * - AskLibraryInput - The input type for the askLibrary function.
 * - AskLibraryOutput - The return type for the ask_library function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';
import { getAllDataForPeriod } from '@/services/firestore';
import { db } from '@/lib/firebaseAdmin';

const AskLibraryInputSchema = z.object({
  question: z.string().describe('The question the coach is asking about the client.'),
  clientId: z.string().describe("The UID of the client to analyze."),
  periodInDays: z.number().default(14).describe("The lookback period in days for client data."),
});
export type AskLibraryInput = z.infer<typeof AskLibraryInputSchema>;

const AskLibraryOutputSchema = z.object({
  answer: z
    .string()
    .describe('The AI-generated answer based on the client\'s data and the provided library context.'),
});
export type AskLibraryOutput = z.infer<typeof AskLibraryOutputSchema>;


export async function askLibrary(
  input: AskLibraryInput
): Promise<AskLibraryOutput> {
  
  // 1. Fetch the site settings to get the configured model name.
  const settings = await getSiteSettingsAction();
  // Use the "pro" model for better reasoning.
  const modelName = settings.data?.aiModelSettings?.pro;
    if (!modelName) {
        throw new Error("The 'Pro' AI model has not been configured in the site settings. Please ask the coach to set it.");
    }
  console.log(`Using AI model for askLibrary (Playground): ${modelName}`);

  // 2. Fetch the specific client's name
  const clientSnap = await db.collection('clients').doc(input.clientId).get();
  if (!clientSnap.exists) {
    throw new Error('Client not found.');
  }
  const clientName = clientSnap.data()?.fullName || 'the client';

  // 3. Fetch all of the client's data for the specified period.
  const historyResult = await getAllDataForPeriod(input.periodInDays, input.clientId);
  if (!historyResult.success) {
      throw new Error(`Failed to fetch user history: ${historyResult.error}`);
  }
   let userHistory = "No data logged for this period.";
  if (historyResult.data && historyResult.data.length > 0) {
     userHistory = JSON.stringify(historyResult.data, null, 2);
  }

  // 4. Fetch all content from the knowledge library.
  const librarySnapshot = await db.collection('library').get();
  let libraryContent = "No library documents found.";
  if (!librarySnapshot.empty) {
    libraryContent = librarySnapshot.docs
      .map(doc => `Document: ${doc.data().name}\nContent: ${doc.data().text}\n---`)
      .join('\n\n');
  }

  // 5. Call the AI with all the context.
  const { output } = await ai.generate({
      model: modelName,
      prompt: `You are an expert wellness coach for the "Hunger Free and Happy" app. Your goal is to answer the coach's question about their client.
      
      Your analysis MUST be based on the provided client data logs and the principles from the expert content library.
      
      - Analyze the client's data to identify patterns, trends, and correlations.
      - Use the expert content to explain the "why" behind these patterns.
      - Formulate a clear, empathetic, and actionable answer to the coach's question.
      - Do not mention "the app," "the book," or "the library" in your response. State principles directly as an expert.
      - Refer to the client by their name: ${clientName}.
      `,
      context: [
        { role: 'user', content: `Here is the expert content from the app's library:\n\n${libraryContent}`},
        { role: 'user', content: `Here is the client's data from the last ${input.periodInDays} days:\n\n${userHistory}`},
        { role: 'user', content: `My (the coach's) question about my client, ${clientName}, is:\n\n"${input.question}"`},
      ],
      output: {
        format: 'json',
        schema: AskLibraryOutputSchema,
      },
      config: {
        safetySettings: [
            {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_NONE',
            },
            {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE',
            },
        ]
      }
  });

  if (!output) {
    throw new Error('The AI failed to generate a valid response.');
  }

  return output;
}

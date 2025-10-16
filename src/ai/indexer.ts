
'use server';
/**
 * @fileOverview Defines a document retriever for Firestore.
 * This retriever connects to a 'library' collection in Firestore
 * and makes them searchable for the AI.
 */
import { defineFirestoreRetriever } from '@genkit-ai/firebase';
import { googleAI } from '@genkit-ai/googleai';
import { ai } from '@/ai/genkit';

// Correctly define and register the retriever in a single step.
export const bookRetriever = ai.defineRetriever(
  {
    name: 'bookRetriever',
    config: {
      collection: 'library',
      contentField: 'text',
      embedder: googleAI.embedder('text-embedding-004'),
    }
  },
  defineFirestoreRetriever
);

/**
 * @fileoverview This file initializes the Genkit AI platform with the necessary plugins.
 * It exports a single `ai` object that is used throughout the application
 * to define and run AI flows, tools, and prompts.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import '@genkit-ai/firebase';

// This is the core 'ai' object that other parts of the application will import.
export const ai = genkit({
  plugins: [googleAI()],
});

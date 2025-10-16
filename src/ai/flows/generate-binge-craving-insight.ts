
'use server';
/**
 * @fileOverview This file defines an algorithmic function for generating a real-time, empathetic insight when a user logs a craving or binge.
 * This replaces the previous AI-powered flow for better performance and cost-efficiency.
 *
 * - generateBingeCravingInsight - A function that takes contextual data and returns a rule-based insight.
 * - GenerateBingeCravingInsightInput - The input type for the function.
 * - GenerateBingeCravingInsightOutput - The return type for the function.
 */

import { z } from 'genkit';

const GenerateBingeCravingInsightInputSchema = z.object({
  logType: z.enum(['craving', 'binge']).describe('The type of event being logged.'),
  context: z.string().describe('A JSON string representing the contextual data around the event (hunger, stress, sleep, etc.).'),
});
export type GenerateBingeCravingInsightInput = z.infer<typeof GenerateBingeCravingInsightInputSchema>;

const GenerateBingeCravingInsightOutputSchema = z.object({
    title: z.string().describe("A short, empathetic, and non-judgmental title for the insight (e.g., 'A Moment for Self-Compassion')."),
    message: z.string().describe('A one-sentence observation connecting a piece of the context to the event. Frame it as a gentle question or observation.'),
    suggestion: z.string().describe('A simple, actionable, and immediate suggestion the user can do right now to help them reset.'),
});
export type GenerateBingeCravingInsightOutput = z.infer<typeof GenerateBingeCravingInsightOutputSchema>;

// --- Algorithmic Insight Generation ---

// Bank of pre-written, empathetic responses for different scenarios.
const responseBank = {
    highStress: {
        title: "Let's Pause and Breathe",
        message: "I notice your stress level was high when this happened. Do you think there might be a connection?",
        suggestions: [
            "How about a 5-minute walk to clear your head and reset?",
            "A few deep, slow breaths can make a world of difference right now. What do you think?",
            "Could we try a quick 3-minute guided meditation to find a moment of calm?"
        ]
    },
    lowSleep: {
        title: 'Could Fatigue Be a Factor?',
        message: "It looks like you had a short night's sleep. Could feeling tired be playing a role in this?",
        suggestions: [
            "A short, 20-minute rest or nap could be incredibly restorative if you have the time.",
            "A glass of cold water can be a great way to re-energize your body and mind.",
            "Let's focus on planning for a restful night tonight to support tomorrow."
        ]
    },
    lowHydration: {
        title: 'A Sip of Awareness',
        message: "Sometimes our bodies mistake thirst for hunger or cravings. I see hydration was a bit low.",
        suggestions: [
            "How about a large glass of water right now? It can be a powerful way to reset your system.",
            "A warm cup of herbal tea can be both hydrating and calming. Would that feel good?",
        ]
    },
    bingeDefault: {
        title: "It's Okay, This is a Data Point",
        message: "Thank you for logging this. Every entry is a learning opportunity, not a failure.",
        suggestions: [
            "The most important step is the one you take next. How about a gentle walk to reconnect with your body?",
            "Let's focus on the next right choice. A glass of water and a few deep breaths can be a great start.",
            "Self-compassion is key. What is one small, kind thing you can do for yourself right now?"
        ]
    },
    cravingDefault: {
        title: "Let's Understand This Craving",
        message: "Thanks for pausing to log this. What do you think this craving is really telling you?",
        suggestions: [
            "Can you try 'surfing the urge' for just 5 minutes? Cravings often pass like waves.",
            "A quick change of scenery can be powerful. Could you step into another room or go outside for a moment?",
        ]
    }
};

/**
 * An algorithmic function to generate an insight based on user-logged data.
 * This is a cost-effective and fast replacement for the previous Genkit flow.
 */
export async function generateBingeCravingInsight(input: GenerateBingeCravingInsightInput): Promise<GenerateBingeCravingInsightOutput> {
    const { logType, context } = input;
    const data = JSON.parse(context);

    // Rule-based decision tree to select the most relevant insight.
    if (data.stress && data.stress > 7) {
        return {
            title: responseBank.highStress.title,
            message: responseBank.highStress.message,
            suggestion: responseBank.highStress.suggestions[Math.floor(Math.random() * responseBank.highStress.suggestions.length)]
        };
    }

    if (data.sleepLastNight && data.sleepLastNight < 6) {
        return {
            title: responseBank.lowSleep.title,
            message: responseBank.lowSleep.message,
            suggestion: responseBank.lowSleep.suggestions[Math.floor(Math.random() * responseBank.lowSleep.suggestions.length)]
        };
    }
    
    // Note: Hydration goal can be personalized, but 64oz is a safe general baseline.
    if (data.hydrationToday && data.hydrationToday < 40) {
         return {
            title: responseBank.lowHydration.title,
            message: responseBank.lowHydration.message,
            suggestion: responseBank.lowHydration.suggestions[Math.floor(Math.random() * responseBank.lowHydration.suggestions.length)]
        };
    }

    // Default responses if no specific trigger is identified.
    if (logType === 'binge') {
        return {
            title: responseBank.bingeDefault.title,
            message: responseBank.bingeDefault.message,
            suggestion: responseBank.bingeDefault.suggestions[Math.floor(Math.random() * responseBank.bingeDefault.suggestions.length)]
        };
    }

    return {
        title: responseBank.cravingDefault.title,
        message: responseBank.cravingDefault.message,
        suggestion: responseBank.cravingDefault.suggestions[Math.floor(Math.random() * responseBank.cravingDefault.suggestions.length)]
    };
}



'use server';

import { createClientFlow, CreateClientInput } from '@/ai/flows/create-client-flow';
import { calculateDailySummariesFlow } from '@/ai/flows/calculate-daily-summaries';
import { db as adminDb, auth, admin } from '@/lib/firebaseAdmin';
import type { ClientProfile, CoachNote, TrackingSettings, UserTier } from '@/types';
import { generateInsight } from '@/ai/flows/generate-insight-flow';
import { getAllDataForPeriod } from '@/services/firestore';
import { createStripeCheckoutSession } from '@/app/client/settings/actions';
import Stripe from 'stripe';


const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
    apiVersion: '2024-06-20',
});


/**
 * Recursively converts Firestore Timestamps to ISO strings to make them serializable.
 * This is critical for nested objects like the `dailySummary`.
 */
function serializeTimestamps(data: any): any {
    if (data === null || data === undefined) {
        return data;
    }
    if (data instanceof admin.firestore.Timestamp) {
        return data.toDate().toISOString();
    }
    if (Array.isArray(data)) {
        return data.map(serializeTimestamps);
    }
    // Check for object-like structures, excluding null and other non-objects
    if (typeof data === 'object' && Object.prototype.toString.call(data) === '[object Object]') {
        const newObject: { [key: string]: any } = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                newObject[key] = serializeTimestamps(data[key]);
            }
        }
        return newObject;
    }
    return data;
}


/**
 * Server action for a COACH to create a new client.
 * This function is designed to be called from the coach dashboard.
 * It creates a user with a verified email and sets them up in Stripe, but does not initiate a subscription.
 */
export async function createClientByCoachAction(data: CreateClientInput) {
  // We explicitly set emailVerified to true for coach-created clients.
  const result = await createClientFlow(data);
  return result;
}

/**
 * Handles the creation of a user account.
 * If the tier is 'free', it creates the user directly.
 * If the tier is paid, it creates a Stripe Checkout session with user data in metadata.
 * The actual user creation for paid tiers is handled by the Stripe webhook.
 */
export async function unifiedSignupAction(
    data: CreateClientInput,
    billingCycle: 'monthly' | 'yearly'
): Promise<{ success: boolean; error?: string; checkoutUrl?: string | null }> {
    
    // For free users, create the account directly and immediately.
    if (data.tier === 'free' || data.tier === 'ad-free') {
        const result = await createClientFlow(data);
        if (result.success) {
            return { success: true, checkoutUrl: null };
        } else {
            return { success: false, error: result.error || "Failed to create free user account." };
        }
    }

    // For paid users, create a Stripe Checkout session.
    try {
        let priceId: string | undefined;

        if (billingCycle === 'monthly') {
            switch (data.tier) {
                case 'basic': priceId = process.env.STRIPE_BASIC_MONTHLY_PRICE_ID; break;
                case 'premium': priceId = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID; break;
                case 'coaching': priceId = process.env.STRIPE_COACHING_MONTHLY_PRICE_ID; break;
            }
        } else { // yearly
            switch (data.tier) {
                case 'basic': priceId = process.env.STRIPE_BASIC_YEARLY_PRICE_ID; break;
                case 'premium': priceId = process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID; break;
                case 'coaching': priceId = process.env.STRIPE_COACHING_YEARLY_PRICE_ID; break;
            }
        }

        if (!priceId) {
            throw new Error(`Price ID for tier "${data.tier}" with billing cycle "${billingCycle}" is not configured.`);
        }

        const returnUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const successUrl = `${returnUrl}/login?signup=success`;
        const cancelUrl = `${returnUrl}/signup`;

        // Create the checkout session, passing all user data in the metadata.
        const checkoutSession = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            // Securely pass all user data to the webhook.
            metadata: {
                userData: JSON.stringify(data)
            }
        });

        if (!checkoutSession.url) {
            throw new Error("Could not create Stripe checkout session.");
        }

        return { success: true, checkoutUrl: checkoutSession.url };

    } catch (error: any) {
        console.error("Error creating paid checkout session:", error);
        return { success: false, error: error.message };
    }
}


/**
 * Server action to manually trigger the daily summary calculation for a single client.
 */
export async function calculateDailySummariesAction(clientId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!clientId) throw new Error("Client ID is required.");
        // We pass dryRun: false to ensure it actually runs.
        await calculateDailySummariesFlow({ clientId, dryRun: false });
        return { success: true };
    } catch(error: any) {
        console.error("Error triggering calculateDailySummariesFlow:", error);
        return { success: false, error: error.message || "An unknown error occurred." };
    }
}


export async function deleteClientAction(clientId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!clientId) throw new Error("Client ID is required for deletion.");
        
        // Note: In a production app with extensive data, a Cloud Function would be better
        // for recursively deleting subcollections to avoid client timeouts.
        // For this app's scope, deleting the primary docs is sufficient to revoke access and remove core data.
        const batch = adminDb.batch();

        const clientRef = adminDb.collection('clients').doc(clientId);
        const userProfileRef = adminDb.collection('userProfiles').doc(clientId);
        
        batch.delete(clientRef);
        batch.delete(userProfileRef);

        await auth.deleteUser(clientId);
        await batch.commit();

        return { success: true };

    } catch (error: any) {
        console.error("Error deleting client:", error);
        return { success: false, error: error.message };
    }
}


/**
 * Server action to get the coaching chat ID for a specific client.
 * Uses the Admin SDK to bypass security rules.
 */
export async function getCoachingChatIdForClient(clientId: string): Promise<{ success: boolean; chatId?: string; error?: any; }> {
    try {
        const chatsRef = adminDb.collection('chats');
        const q = chatsRef
            .where('type', '==', 'coaching')
            .where('participants', 'array-contains', clientId)
            .limit(1);

        const snapshot = await q.get();

        if (snapshot.empty) {
            return { success: true, chatId: undefined };
        }
        
        const chatId = snapshot.docs[0].id;
        return { success: true, chatId };
        
    } catch (error: any) {
        console.error(`Error getting coaching chat ID for client ${clientId}:`, error);
        return { success: false, error: { message: error.message || 'An unknown error occurred' } };
    }
}

/**
 * Secure server action to update a client's WtHR summary.
 * This function NO LONGER creates a historical record. It only updates the
 * summary on the main client document. Historical records are created by saveDataAction.
 */
export async function updateClientWthr(clientId: string, newWaist: number): Promise<{ success: boolean; error?: string }> {
    try {
        const clientRef = adminDb.collection('clients').doc(clientId);
        
        const clientSnap = await clientRef.get();
        if (!clientSnap.exists) {
            return { success: false, error: "Client not found." };
        }
        
        const clientProfile = clientSnap.data() as ClientProfile;
        const onboardingData = clientProfile.onboarding;

        if (!onboardingData || !onboardingData.height) {
            return { success: true }; // Not an error, just can't calculate.
        }
        
        const { height, units = 'imperial' } = onboardingData;

        const CM_TO_INCH = 0.393701;
        let heightInInches = height;
        let waistInInches = newWaist;

        if (units === 'metric') {
            heightInInches *= CM_TO_INCH;
            waistInInches *= CM_TO_INCH;
        }

        const wthr = heightInInches > 0 ? (waistInInches / heightInInches) : 0;
        
        // This function now ONLY updates the summary field.
        await clientRef.update({ 'dailySummary.currentWthr': wthr });
        
        return { success: true };

    } catch (error: any) {
        console.error(`Error updating WtHR for client ${clientId}:`, error);
        return { success: false, error: error.message };
    }
}


/**
 * Retrieves all coach notes for a given client.
 */
export async function getCoachNotesAction(clientId: string): Promise<{ success: boolean; data?: CoachNote[]; error?: string }> {
    try {
        const notesRef = adminDb.collection(`clients/${clientId}/coachNotes`).orderBy('createdAt', 'desc');
        const snapshot = await notesRef.get();
        const notes = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                note: data.note,
                coachName: data.coachName,
                coachId: data.coachId,
                createdAt: (data.createdAt as admin.firestore.Timestamp).toDate().toISOString(),
            }
        });
        return { success: true, data: notes as CoachNote[] };
    } catch (error: any) {
        console.error("Error fetching coach notes:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Adds a new note to a client's record from a coach.
 */
export async function addCoachNoteAction(clientId: string, note: string, coachId: string, coachName: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!note.trim()) {
            return { success: false, error: "Note cannot be empty." };
        }

        const noteData = {
            note,
            coachId,
            coachName,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const notesRef = adminDb.collection(`clients/${clientId}/coachNotes`);
        await notesRef.add(noteData);

        return { success: true };
    } catch (error: any) {
        console.error("Error adding coach note:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches a single client's profile by their UID using the Admin SDK.
 */
export async function getClientByIdAction(clientId: string): Promise<{ success: boolean; data?: ClientProfile; error?: string }> {
    try {
        if (!clientId) {
            throw new Error("Client ID is required.");
        }

        const clientRef = adminDb.collection('clients').doc(clientId);
        const clientSnap = await clientRef.get();

        if (!clientSnap.exists) {
            return { success: false, error: "Client not found." };
        }

        const clientData = { uid: clientSnap.id, ...clientSnap.data() };
        
        const serializableData = serializeTimestamps(clientData);

        return { success: true, data: serializableData as ClientProfile };
    } catch (error: any) {
        console.error(`Error fetching client ${clientId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Generates an AI-powered insight for a specific client based on their data.
 */
export async function generateClientInsightAction(clientId: string, periodInDays: number) {
    try {
        const result = await getAllDataForPeriod(periodInDays, clientId);
        if (!result.success || !result.data || result.data.length === 0) {
            return { success: false, error: `Log at least one activity in the last ${periodInDays} days to get your insight.` };
        }

        const history = JSON.stringify(result.data, null, 2);
        const insightResult = await generateInsight({ history, periodInDays });

        return { success: true, data: insightResult };
    } catch (error: any) {
        console.error(`Error generating insight for client ${clientId}:`, error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}

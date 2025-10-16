

'use server';

import { db as adminDb, auth as adminAuth, admin } from '@/lib/firebaseAdmin';
import type { TrackingSettings, ClientProfile, NutritionalGoals } from '@/types';
import { uploadImageAction } from '@/app/coach/actions';
import { calculateNutritionalGoals } from '@/services/goals';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
    apiVersion: '2024-06-20',
});


/**
 * Creates a Stripe Checkout session to allow a user to start a new subscription.
 * This function now supports both 'monthly' and 'yearly' billing cycles.
 */
export async function createStripeCheckoutSession(
    clientId: string,
    tier: 'ad-free' | 'basic' | 'premium' | 'coaching',
    billingCycle: 'monthly' | 'yearly'
): Promise<{ url?: string; error?: string; }> {
    try {
        if (!clientId) throw new Error("Client ID is required.");

        const clientRef = adminDb.collection('clients').doc(clientId);
        const clientSnap = await clientRef.get();
        if (!clientSnap.exists) throw new Error("Client profile not found.");

        const clientData = clientSnap.data() as ClientProfile;
        const stripeCustomerId = clientData.stripeCustomerId;
        if (!stripeCustomerId) throw new Error("Stripe customer ID not found for this client.");

        let priceId: string | undefined;

        if (billingCycle === 'monthly') {
            switch (tier) {
                case 'ad-free': priceId = process.env.STRIPE_AD_FREE_MONTHLY_PRICE_ID; break;
                case 'basic': priceId = process.env.STRIPE_BASIC_MONTHLY_PRICE_ID; break;
                case 'premium': priceId = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID; break;
                case 'coaching': priceId = process.env.STRIPE_COACHING_MONTHLY_PRICE_ID; break;
            }
        } else { // yearly
            switch (tier) {
                case 'ad-free': priceId = process.env.STRIPE_AD_FREE_YEARLY_PRICE_ID; break;
                case 'basic': priceId = process.env.STRIPE_BASIC_YEARLY_PRICE_ID; break;
                case 'premium': priceId = process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID; break;
                case 'coaching': priceId = process.env.STRIPE_COACHING_YEARLY_PRICE_ID; break;
            }
        }


        if (!priceId) throw new Error(`Price ID for tier "${tier}" with billing cycle "${billingCycle}" is not configured in environment variables.`);
        
        const returnUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000/client/dashboard';
        
        const checkoutSession = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: returnUrl,
        });

        if (!checkoutSession.url) throw new Error("Could not create Stripe checkout session.");
        
        return { url: checkoutSession.url };
        
    } catch (error: any) {
        console.error("Error creating Stripe checkout session:", error);
        return { error: error.message };
    }
}


/**
 * Creates a Stripe Customer Portal session and returns the URL.
 * Creates a Stripe Customer if one doesn't exist.
 */
export async function createStripePortalSession(clientId: string): Promise<{ url?: string; error?: string; }> {
    try {
        const clientRef = adminDb.collection('clients').doc(clientId);
        const clientSnap = await clientRef.get();

        if (!clientSnap.exists) {
            throw new Error("Client profile not found.");
        }

        const clientData = clientSnap.data() as ClientProfile;
        let stripeCustomerId = clientData.stripeCustomerId;

        // If the user doesn't have a Stripe Customer ID, create one.
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: clientData.email,
                name: clientData.fullName,
                metadata: {
                    firebaseUID: clientId,
                },
            });
            stripeCustomerId = customer.id;
            await clientRef.update({ stripeCustomerId });
        }

        // Get the return URL from environment variables or default to localhost
        const returnUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000/client/dashboard';

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: returnUrl,
            configuration: process.env.STRIPE_PORTAL_CONFIG_ID,
        });

        return { url: portalSession.url };

    } catch (error: any) {
        console.error("Error creating Stripe portal session:", error);
        return { error: error.message };
    }
}


/**
 * Updates a client's settings. This is a generic action to update
 * various settings on the client's profile document.
 */
export async function updateClientSettingsAction(clientId: string, settings: Partial<TrackingSettings>): Promise<{ success: boolean; error?: string }> {
    try {
        if (!clientId) {
            throw new Error("Client ID is required.");
        }

        const clientRef = adminDb.collection('clients').doc(clientId);
        const userProfileRef = adminDb.collection('userProfiles').doc(clientId);
        
        const updatePayload: any = {};
        
        if (settings.units) {
            updatePayload['onboarding.units'] = settings.units;
        }

        const trackingSettings: any = {};
        for (const key in settings) {
            if (key !== 'units') {
                trackingSettings[key as keyof Omit<TrackingSettings, 'units'>] = settings[key as keyof Omit<TrackingSettings, 'units'>];
            }
        }

        if (Object.keys(trackingSettings).length > 0) {
             updatePayload.trackingSettings = trackingSettings;
        }

        // Use set with merge:true to avoid dot notation issues with nested objects
        await clientRef.set({ trackingSettings: trackingSettings }, { merge: true });
        if(settings.units) {
            await clientRef.set({ onboarding: { units: settings.units } }, { merge: true });
            await userProfileRef.set({ onboarding: { units: settings.units } }, { merge: true });
        }
        await userProfileRef.set({ trackingSettings: trackingSettings }, { merge: true });

        return { success: true };
    } catch (error: any) {
        console.error(`Error updating settings for client ${clientId}:`, error);
        return { success: false, error: error.message };
    }
}


/**
 * Master action to update a client's profile settings and recalculate nutritional goals.
 * This function now calculates the final goals on the server and saves the complete object.
 */
export async function updateClientProfileAndGoalsAction(
    clientId: string,
    data: {
        activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
        calculationMode?: 'ideal' | 'actual' | 'custom';
        calorieModifier?: number;
        customMacros?: { protein?: number | ''; fat?: number | ''; carbs?: number | '' };
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!clientId) {
            throw new Error("Client ID is required.");
        }

        const clientRef = adminDb.collection('clients').doc(clientId);
        const clientSnap = await clientRef.get();
        if (!clientSnap.exists) {
            throw new Error("Client profile not found.");
        }
        
        const existingClientData = clientSnap.data() as ClientProfile;

        // Create a temporary profile with the new user inputs to feed into the calculation engine.
        const tempProfileForCalc: ClientProfile = {
            ...existingClientData,
            customGoals: {
                ...existingClientData.customGoals,
                calculationMode: data.calculationMode,
                activityLevel: data.activityLevel,
                calorieModifier: data.calorieModifier,
                protein: typeof data.customMacros?.protein === 'number' ? data.customMacros.protein : undefined,
                fat: typeof data.customMacros?.fat === 'number' ? data.customMacros.fat : undefined,
                carbs: data.customMacros?.carbs === '' ? undefined : (typeof data.customMacros?.carbs === 'number' ? data.customMacros.carbs : undefined),
            },
        };

        // Run the authoritative calculation engine.
        const allGoalSets = calculateNutritionalGoals(tempProfileForCalc);
        
        // Select the correct, fully calculated goal set based on the user's chosen mode.
        let goalsToSave: NutritionalGoals;
        switch (data.calculationMode) {
            case 'ideal':
                goalsToSave = allGoalSets.idealGoals;
                break;
            case 'actual':
                goalsToSave = allGoalSets.actualGoals;
                break;
            case 'custom':
                goalsToSave = allGoalSets.customGoals;
                break;
            default:
                // Fallback to ideal if mode is somehow undefined
                goalsToSave = allGoalSets.idealGoals;
                break;
        }

        // Save the entire, calculated goal object to Firestore. This is the single source of truth.
        await clientRef.update({
            customGoals: goalsToSave,
            'onboarding.activityLevel': data.activityLevel // Also update the base activity level
        });

        return { success: true };

    } catch (error: any) {
        console.error(`Error updating profile and goals for client ${clientId}:`, error);
        return { success: false, error: error.message };
    }
}


/**
 * Updates a user's profile information in Auth and Firestore.
 */
export async function updateUserProfileAction(uid: string, data: { fullName?: string; email?: string; phone?: string; photoURL?: string; }): Promise<{ success: boolean; error?: string }> {
    try {
        const { photoURL, ...restData } = data;
        let finalPhotoUrl = photoURL;

        if (finalPhotoUrl && finalPhotoUrl.startsWith('data:image')) {
            const uploadResult = await uploadImageAction(finalPhotoUrl, `profile-pictures/${uid}`);
            if (uploadResult.success && uploadResult.url) {
                finalPhotoUrl = uploadResult.url;
            } else {
                throw new Error(uploadResult.error || 'Failed to upload new profile picture.');
            }
        }

        const authUpdatePayload: any = {};
        if (restData.fullName) authUpdatePayload.displayName = restData.fullName;
        if (restData.email) authUpdatePayload.email = restData.email;
        if (finalPhotoUrl) authUpdatePayload.photoURL = finalPhotoUrl;

        if (Object.keys(authUpdatePayload).length > 0) {
            await adminAuth.updateUser(uid, authUpdatePayload);
        }
        
        const profileRef = adminDb.collection('userProfiles').doc(uid);
        const firestoreUpdatePayload: any = { ...restData };
        if (finalPhotoUrl) firestoreUpdatePayload.photoURL = finalPhotoUrl;

        if(Object.keys(firestoreUpdatePayload).length > 0) {
            await profileRef.set(firestoreUpdatePayload, { merge: true });
        }

        return { success: true };
    } catch (error: any) {
        console.error(`Error updating profile for user ${uid}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Updates a user's password in Firebase Auth.
 * Requires the user to be recently authenticated.
 */
export async function updateUserPasswordAction(uid: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
        await adminAuth.updateUser(uid, { password: newPassword });
        return { success: true };
    } catch (error: any) {
        console.error(`Error updating password for user ${uid}:`, error);
        return { success: false, error: error.message };
    }
}

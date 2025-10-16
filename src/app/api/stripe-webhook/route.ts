
'use server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { db as adminDb } from '@/lib/firebaseAdmin';
import type { UserTier, ClientProfile } from '@/types';
import { createClientFlow, CreateClientInput } from '@/ai/flows/create-client-flow';

const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
  apiVersion: '2024-06-20',
});

// This is the mapping from your Stripe Price IDs to your application's tier names.
// It's crucial that these Price IDs match what you have configured in your Stripe Dashboard.
const priceIdToTier: Record<string, UserTier> = {
    // Monthly
    [process.env.STRIPE_AD_FREE_MONTHLY_PRICE_ID || '']: 'ad-free',
    [process.env.STRIPE_BASIC_MONTHLY_PRICE_ID || '']: 'basic',
    [process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || '']: 'premium',
    [process.env.STRIPE_COACHING_MONTHLY_PRICE_ID || '']: 'coaching',
    // Yearly
    [process.env.STRIPE_AD_FREE_YEARLY_PRICE_ID || '']: 'ad-free',
    [process.env.STRIPE_BASIC_YEARLY_PRICE_ID || '']: 'basic',
    [process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID || '']: 'premium',
    [process.env.STRIPE_COACHING_YEARLY_PRICE_ID || '']: 'coaching',
};

export async function POST(req: NextRequest) {
    const body = await req.text();
    const signature = headers().get('Stripe-Signature') as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error("CRITICAL: STRIPE_WEBHOOK_SECRET is not set.");
        return new NextResponse('Webhook secret not configured on server.', { status: 500 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // --- NEW: Handle account creation after successful payment ---
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        
        const userDataString = session.metadata?.userData;

        if (!userDataString) {
            console.error("Webhook Error: checkout.session.completed event is missing userData in metadata.", session.id);
            // Return 200 to Stripe so it doesn't retry for this non-actionable event.
            return NextResponse.json({ received: true, message: "No user data in metadata." });
        }
        
        try {
            const userData: CreateClientInput = JSON.parse(userDataString);
            
            // Call the existing, robust flow to create the user in Firebase Auth and Firestore
            const result = await createClientFlow(userData);

            if (!result.success) {
                // If user creation fails for some reason (e.g., email already exists unexpectedly),
                // log a critical error for manual review.
                console.error(`CRITICAL: Webhook could not create user after successful payment for email: ${userData.email}. Error: ${result.error}`);
                // We still return a 200 to Stripe to acknowledge receipt and prevent retries.
                // The issue is now on our end to resolve.
                return new NextResponse(`Internal Server Error: ${result.error}`, { status: 500 });
            }
            
            console.log(`Successfully created user ${userData.email} via Stripe webhook.`);

        } catch (error: any) {
            console.error('CRITICAL: Failed to process checkout.session.completed webhook.', error);
            return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
        }
    }


    // --- EXISTING: Handle subscription tier changes for existing users ---
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        try {
            // Find the user in our database who has this Stripe Customer ID.
            const clientsQuery = adminDb.collection('clients').where('stripeCustomerId', '==', customerId).limit(1);
            
            const [clientsSnapshot] = await Promise.all([clientsQuery.get()]);

            let firebaseUserId: string | null = null;
            if (!clientsSnapshot.empty) {
                firebaseUserId = clientsSnapshot.docs[0].id;
            } else {
                 const userProfileQuery = adminDb.collection('userProfiles').where('stripeCustomerId', '==', customerId).limit(1);
                 const userProfilesSnapshot = await userProfileQuery.get();
                 if (!userProfilesSnapshot.empty) {
                     firebaseUserId = userProfilesSnapshot.docs[0].id;
                 }
            }


            if (!firebaseUserId) {
                // This can happen if it's the initial 'customer.subscription.created' event for a new sign-up.
                // It's safe to ignore in that case, as the 'checkout.session.completed' handles creation.
                console.log(`Webhook received subscription update for Stripe customer ${customerId}, but no matching Firebase user found yet. This is expected for new sign-ups.`);
                return NextResponse.json({ received: true, message: 'User not found, likely a new sign-up handled by checkout session.' });
            }

            const subscriptionItem = subscription.items.data[0];
            const priceId = subscriptionItem?.price.id;

            // Determine the new tier. If the plan is cancelled or the price ID is unknown,
            // default them to the 'free' tier.
            const newTier: UserTier = (subscription.status === 'active' && priceId && priceIdToTier[priceId])
                ? priceIdToTier[priceId]
                : 'free';

            // Update the tier in both the 'clients' and 'userProfiles' collections for consistency.
            const clientRef = adminDb.collection('clients').doc(firebaseUserId);
            const userProfileRef = adminDb.collection('userProfiles').doc(firebaseUserId);
            
            await clientRef.update({ tier: newTier });
            await userProfileRef.update({ tier: newTier });

            console.log(`Successfully updated user ${firebaseUserId} to tier: ${newTier} via subscription update.`);

        } catch (error) {
            console.error('Error handling subscription update:', error);
            return new NextResponse('Internal server error while updating user tier.', { status: 500 });
        }
    }

    return NextResponse.json({ received: true });
}

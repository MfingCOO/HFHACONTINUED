
'use server';
/**
 * @fileOverview A server-side flow for a coach to create a new client account.
 * This flow handles user creation in Firebase Auth, Firestore document creation,
 * Stripe customer creation, and initiates a coaching chat if needed.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { auth, db } from '@/lib/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { UserTier, ClientProfile } from '@/types';
import { TIER_ACCESS } from '@/types';
import { COACH_UIDS } from '@/lib/coaches';
import { calculateNutritionalGoals } from '@/services/goals';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
    apiVersion: '2024-06-20',
});


const CreateClientInputSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(2),
    tier: z.enum(TIER_ACCESS),
    birthdate: z.string(),
    sex: z.enum(['male', 'female', 'unspecified']),
    units: z.enum(['imperial', 'metric']),
    height: z.number(),
    weight: z.number(),
    waist: z.number(),
    zipCode: z.string(),
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
    wakeTime: z.string(),
    sleepTime: z.string(),
});

export type CreateClientInput = z.infer<typeof CreateClientInputSchema>;

const ALL_DATA_COLLECTIONS = [
    'nutrition', 'hydration', 'activity', 'sleep', 
    'stress', 'measurements', 'protocol', 'planner', 'cravings'
];


export const createClientFlow = ai.defineFlow(
  {
    name: 'createClientFlow',
    inputSchema: CreateClientInputSchema,
    outputSchema: z.object({ success: z.boolean(), uid: z.string().optional(), error: z.string().optional() }),
  },
  async (data) => {
    let uid = '';
    try {
      
      // 1. Create user in Firebase Auth using Admin SDK
      const userRecord = await auth.createUser({
        email: data.email,
        password: data.password,
        displayName: data.fullName,
        emailVerified: true,
      });

      uid = userRecord.uid;
      
      // 2. Create Stripe Customer and link it to the Firebase UID
      const stripeCustomer = await stripe.customers.create({
          email: data.email,
          name: data.fullName,
          metadata: {
              firebaseUID: uid,
          }
      });
      const stripeCustomerId = stripeCustomer.id;
      
      const batch = db.batch();

      // 3. Create userProfile document.
      const userProfileRef = db.collection('userProfiles').doc(uid);
      batch.set(userProfileRef, {
          uid: uid,
          email: data.email,
          fullName: data.fullName,
          chatIds: [],
          challengeIds: [],
          tier: data.tier, 
          role: 'client',
      });

      // Calculate WtHR & Ideal Body Weight
      const CM_TO_INCH = 0.393701;
      let heightInInches = data.units === 'metric' ? data.height * CM_TO_INCH : data.height;
      let waistInInches = data.units === 'metric' ? data.waist * CM_TO_INCH : data.waist;
      const wthr = heightInInches > 0 ? (waistInInches / heightInInches) : 0;
      
      const idealBodyWeight = (25 * heightInInches * heightInInches) / 703;
      const suggestedHydrationGoal = Math.round(idealBodyWeight);

      // 4. Create a partial client profile to pass to the goal calculation service.
      const clientDataForGoals: Partial<ClientProfile> = {
        onboarding: { ...data },
        customGoals: {},
        idealBodyWeight: idealBodyWeight,
      };

      // 5. Calculate all nutritional goals.
      const initialGoals = calculateNutritionalGoals(clientDataForGoals as ClientProfile);
      
      // 6. Create client document with all data, including the new Stripe Customer ID.
      const clientDocRef = db.collection('clients').doc(uid);
      batch.set(clientDocRef, {
        uid: uid,
        email: data.email,
        fullName: data.fullName,
        tier: data.tier,
        createdAt: Timestamp.now(),
        coachingChatCreated: false,
        stripeCustomerId: stripeCustomerId, // Save the Stripe Customer ID
        onboarding: { ...data },
        wthr: wthr,
        idealBodyWeight: idealBodyWeight,
        suggestedHydrationGoal: suggestedHydrationGoal,
        suggestedGoals: initialGoals, 
        customGoals: initialGoals, 
      });
      
      // 7. Create initial measurement entry.
      const initialMeasurementRef = clientDocRef.collection('measurements').doc();
      batch.set(initialMeasurementRef, {
          weight: data.weight,
          waist: data.waist,
          wthr: wthr,
          entryDate: Timestamp.now(),
          notes: 'Initial measurement from onboarding.',
          uid: uid,
          createdAt: Timestamp.now(),
      });


      // 8. Pre-create other subcollections.
      for (const collectionName of ALL_DATA_COLLECTIONS) {
          if (collectionName === 'measurements') continue;
          const placeholderRef = clientDocRef.collection(collectionName).doc('_placeholder');
          batch.set(placeholderRef, { createdAt: Timestamp.now() });
      }
      
      // 9. If tier is 'coaching', handle chat creation logic.
      if (data.tier === 'coaching') {
          const coachIds = COACH_UIDS;
          const participants = [uid, ...coachIds];
          const chatData = {
              name: `${data.fullName} Coaching`,
              description: `Private coaching for ${data.fullName}`,
              type: 'coaching' as const,
              participants: participants,
              participantCount: participants.length,
              createdAt: Timestamp.now(),
              lastClientMessage: Timestamp.now(),
          };
          
          const chatDocRef = db.collection("chats").doc();
          batch.set(chatDocRef, chatData);
          const chatId = chatDocRef.id;
          
          const chatMessagesRef = db.collection(`chats/${chatId}/messages`).doc();
          batch.set(chatMessagesRef, {
              userId: 'system',
              userName: 'System',
              text: `Coaching chat for ${data.fullName} created.`,
              timestamp: Timestamp.now(),
              isSystemMessage: true,
          });

          for (const participantUid of participants) {
              const profileRef = db.collection('userProfiles').doc(participantUid);
               batch.update(profileRef, { chatIds: FieldValue.arrayUnion(chatId) });
          }
          
          batch.update(clientDocRef, { coachingChatCreated: true });
      }

      // 10. Commit all batched writes atomically
      await batch.commit();

      return { success: true, uid: userRecord.uid };
    } catch (error: any) {
      console.error("Error creating client in admin flow:", error);
      const errorMessage = error.code || error.message || "An unknown error occurred.";
      
      if (uid) {
        try {
            await auth.deleteUser(uid);
            console.log(`Successfully cleaned up auth user: ${uid}`);
            await db.collection('clients').doc(uid).delete();
            await db.collection('userProfiles').doc(uid).delete();
            console.log(`Successfully cleaned up firestore docs for user: ${uid}`);
        } catch (cleanupError: any) {
            console.error(`CRITICAL: Failed to cleanup user ${uid} after creation error. Manual cleanup required.`, cleanupError);
            return { success: false, error: `CRITICAL: Failed to cleanup user. ${errorMessage}` };
        }
      }
      
      return { success: false, error: errorMessage };
    }
  }
);


'use server';

import { db as adminDb, admin, auth } from '@/lib/firebaseAdmin';
import type { Challenge, Chat } from '@/services/firestore';
import { z } from 'zod';
import { Buffer } from 'buffer';


function serializeTimestamps(docData: any) {
    if (!docData) return docData;
    const newObject: { [key: string]: any } = { ...docData };
    for (const key in newObject) {
        if (newObject[key] && typeof newObject[key].toDate === 'function') {
            newObject[key] = newObject[key].toDate().toISOString();
        } else if (key === 'dates' && newObject.dates) {
            newObject.dates = {
                from: newObject.dates.from.toDate().toISOString(),
                to: newObject.dates.to.toDate().toISOString(),
            }
        } else if (typeof newObject[key] === 'object' && newObject[key] !== null && !Array.isArray(newObject[key])) {
            newObject[key] = serializeTimestamps(newObject[key]);
        }
    }
    return newObject;
}

/**
 * Fetches all challenges for a coach using the Admin SDK to bypass security rules.
 */
export async function getChallengesForCoach(): Promise<{ success: boolean; data?: Challenge[]; error?: any; }> {
    try {
        const challengesQuery = adminDb.collection('challenges').orderBy("dates.from", "desc");
        const challengesSnapshot = await challengesQuery.get();
        
        const challenges = challengesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Challenge);
        const serializableData = challenges.map(serializeTimestamps);

        return { success: true, data: serializableData as Challenge[] };

    } catch (error: any) {
        console.error("Error fetching challenges for coach (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}

/**
 * Fetches details for a single challenge using the Admin SDK.
 */
export async function getChallengeDetailsForCoach(challengeId: string): Promise<{ success: boolean; data?: Challenge; error?: any; }> {
    try {
        const docRef = adminDb.collection('challenges').doc(challengeId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = { id: docSnap.id, ...docSnap.data() };
            const serializableData = serializeTimestamps(data);
            return { success: true, data: serializableData as Challenge };
        }
        return { success: false, error: 'Challenge not found' };
    } catch (error: any) {
        console.error('Error getting challenge details (admin):', error);
        return { success: false, error: { message: error.message || 'An unknown admin error occurred' } };
    }
}


const scheduledPillarSchema = z.object({
    pillarId: z.string().min(1, 'Please select a pillar.'),
    days: z.array(z.string()).min(1, 'You must select at least one day.'),
    recurrenceType: z.enum(['weekly', 'custom']),
    recurrenceInterval: z.coerce.number().optional(),
    notes: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.recurrenceType === 'custom' && (!data.recurrenceInterval || data.recurrenceInterval <= 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Interval must be at least 1.",
            path: ["recurrenceInterval"],
        });
    }
});


const customTaskSchema = z.object({
    description: z.string().min(1, 'Task description cannot be empty.'),
    startDay: z.coerce.number().min(1, "Start day must be at least 1."),
    unit: z.enum(['reps', 'seconds', 'minutes']),
    goalType: z.enum(['static', 'progressive', 'user-records']),
    goal: z.coerce.number().optional(),
    startingGoal: z.coerce.number().optional(),
    increaseBy: z.coerce.number().optional(),
    increaseEvery: z.enum(['week', '2-weeks', 'month']).optional(),
    notes: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.goalType === 'static') {
        if (!data.goal || data.goal <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Goal must be at least 1.",
                path: ["goal"],
            });
        }
    } else if (data.goalType === 'progressive') {
        if (!data.startingGoal || data.startingGoal <= 0) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Starting goal must be at least 1.",
                path: ["startingGoal"],
            });
        }
        if (!data.increaseBy || data.increaseBy <= 0) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Increase must be at least 1.",
                path: ["increaseBy"],
            });
        }
        if (!data.increaseEvery) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Please select a frequency.",
                path: ["increaseEvery"],
            });
        }
    }
});

const scheduledHabitSchema = z.object({
    habitId: z.string().min(1, 'Please select a habit.'),
    days: z.array(z.string()).min(1, 'You must select at least one day.'),
    recurrenceType: z.enum(['weekly', 'custom']),
    recurrenceInterval: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
    if (data.recurrenceType === 'custom' && (!data.recurrenceInterval || data.recurrenceInterval <= 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Interval must be at least 1.",
            path: ["recurrenceInterval"],
        });
    }
});


const challengeSchema = z.object({
    id: z.string().optional(), // For editing
    name: z.string().min(5, 'Challenge name must be at least 5 characters.'),
    description: z.string().min(10, 'Description must be at least 10 characters.'),
    startDate: z.date({ required_error: "A start date is required." }),
    durationDays: z.coerce.number().min(1, 'Duration must be at least 1 day.'),
    maxParticipants: z.coerce.number().min(1, 'Must have at least one participant.'),
    thumbnailUrl: z.string().optional(), // Can be data URI initially, will be converted to URL
    notes: z.string().optional(),
    scheduledPillars: z.array(scheduledPillarSchema).optional(),
    customTasks: z.array(customTaskSchema).optional(),
    scheduledHabits: z.array(scheduledHabitSchema).optional(),
}).refine(data => (data.scheduledPillars && data.scheduledPillars.length > 0) || (data.customTasks && data.customTasks.length > 0) || (data.scheduledHabits && data.scheduledHabits.length > 0), {
    message: "A challenge must have at least one pillar, custom task, or scheduled habit.",
    path: ["scheduledPillars"],
});

/**
 * Server action to create or update a challenge.
 * This function is designed to be called from client components and uses admin privileges.
 */
export async function upsertChallengeAction(challengeData: z.infer<typeof challengeSchema>) {
    try {
        const { id, startDate, durationDays, ...restOfData } = challengeData;
        const fromDate = startDate;
        const toDate = new Date(fromDate);
        toDate.setDate(toDate.getDate() + durationDays);
        
        let finalThumbnailUrl = restOfData.thumbnailUrl || '';

        // Check if a new image was uploaded. Data URLs start with 'data:image'.
        if (finalThumbnailUrl && finalThumbnailUrl.startsWith('data:image')) {
            const uploadResult = await uploadImageAction(finalThumbnailUrl, 'challenge-thumbnails');
            if (uploadResult.success && uploadResult.url) {
                finalThumbnailUrl = uploadResult.url;
            } else {
                // Handle upload failure, maybe set a default or throw an error
                throw new Error(uploadResult.error || 'Failed to upload thumbnail');
            }
        }
        
        const challengeToSave = {
            ...restOfData,
            thumbnailUrl: finalThumbnailUrl, // Use the potentially new URL
            dates: {
                from: admin.firestore.Timestamp.fromDate(fromDate),
                to: admin.firestore.Timestamp.fromDate(toDate),
            },
        };

        if (id) {
            // Updating an existing challenge
            const challengeRef = adminDb.collection("challenges").doc(id);
            await challengeRef.update(challengeToSave);
            return { success: true, id: id };
        } else {
            // Creating a new challenge
            const challengeWithMeta = {
                ...challengeToSave,
                type: 'challenge',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                participantCount: 0,
                participants: [],
            };
            
            const newDoc = await adminDb.collection("challenges").add(challengeWithMeta);
            return { success: true, id: newDoc.id };
        }
    } catch (error: any) {
        console.error("Error saving challenge via server action: ", error);
        return { success: false, error: { message: error.message || "An unknown error occurred" } };
    }
}


/**
 * Deletes a challenge and its associated chat.
 */
export async function deleteChallengeAction(challengeId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!challengeId) {
            throw new Error("No challenge ID provided for deletion.");
        }
        // This action is now simplified. It only deletes the challenge itself.
        // Associated chats are managed independently.
        await adminDb.collection('challenges').doc(challengeId).delete();
        
        return { success: true };

    } catch (error: any) {
        console.error("Error deleting challenge:", error);
        return { success: false, error: error.message };
    }
}


/**
 * Server action to generate a signed URL for a client-side file upload.
 * This acts as a proxy to bypass client-side CORS issues and uses the Admin SDK.
 */
export async function uploadImageAction(base64DataUrl: string, path: string): Promise<{ success: boolean, url?: string, error?: string }> {
    if (!base64DataUrl || !base64DataUrl.startsWith('data:image')) {
        return { success: false, error: 'Invalid image data URL.' };
    }

    try {
        const bucket = admin.storage().bucket('gs://hunger-free-and-happy-app.firebasestorage.app');
        
        const fileName = `${path}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.png`;
        const file = bucket.file(fileName);

        const base64String = base64DataUrl.split(',')[1];
        const buffer = Buffer.from(base64String, 'base64');

        await file.save(buffer, {
            metadata: { contentType: 'image/png' },
            public: true, 
            validation: 'md5'
        });

        // The public URL is the correct URL to return to the client.
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

        return { success: true, url: publicUrl };

    } catch (error: any) {
        console.error("Error uploading image via server action: ", error);
        return { success: false, error: error.message || 'Failed to upload image.' };
    }
}

/**
 * Server action for a user to update their own profile picture.
 */
export async function updateUserProfilePictureAction(uid: string, dataUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!uid || !dataUrl) {
            throw new Error("User ID and image data are required.");
        }

        const uploadResult = await uploadImageAction(dataUrl, `profile-pictures/${uid}`);

        if (uploadResult.success && uploadResult.url) {
            await auth.updateUser(uid, {
                photoURL: uploadResult.url
            });
            // Also update the userProfiles doc for consistency, though less critical
            await adminDb.collection('userProfiles').doc(uid).set({
                photoURL: uploadResult.url
            }, { merge: true });
            return { success: true };
        } else {
            throw new Error(uploadResult.error || 'Failed to upload new profile picture.');
        }

    } catch (error: any) {
        console.error(`Error updating profile picture for UID ${uid}:`, error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}

/**
 * Updates a coach's email in Firebase Auth and Firestore.
 */
export async function updateCoachEmailAction(uid: string, newEmail: string): Promise<{ success: boolean; error?: string }> {
    try {
        await auth.updateUser(uid, { email: newEmail });
        // Also update the userProfiles and coaches collection if they exist, for consistency
        await adminDb.collection('userProfiles').doc(uid).update({ email: newEmail });
        return { success: true };
    } catch (error: any) {
        console.error(`Error updating email for coach ${uid}:`, error);
        if (error.code === 'auth/email-already-exists') {
            return { success: false, error: 'This email is already in use by another account.' };
        }
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}

/**
 * Updates a coach's password in Firebase Auth.
 * This action requires the user to be recently authenticated on the client.
 * The client should handle reauthentication if necessary before calling this.
 */
export async function updateCoachPasswordAction(uid: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
        await auth.updateUser(uid, { password: newPassword });
        return { success: true };
    } catch (error: any) {
        console.error(`Error updating password for coach ${uid}:`, error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}

/**
 * Fetches the global site settings, including AI model configuration.
 * This is the missing function required by the askLibraryFlow.
 * Uses the Admin SDK to bypass security rules.
 */
export async function getSiteSettingsAction(): Promise<{ success: boolean; data?: any; error?: any; }> {
    try {
        // Fetch from the expected path: collections/siteSettings/documents/v1
        const docRef = adminDb.collection('siteSettings').doc('v1');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            // Return the full document data
            return { success: true, data: data };
        }
        
        // Return a success status with empty data if the settings document hasn't been created yet.
        // The AI flow is designed to handle this by falling back to the default model.
        return { success: true, data: {} }; 
        
    } catch (error: any) {
        console.error("Error fetching site settings (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}

  

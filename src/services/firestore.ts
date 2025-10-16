

'use server';

import { db as adminDb, admin } from '@/lib/firebaseAdmin';
import { differenceInCalendarDays, startOfDay, subDays, subHours } from 'date-fns';
import type { UserTier, ClientProfile, UserProfile } from '@/types';
import { generateHolisticInsight } from '@/ai/flows/generate-holistic-insight';
import { calculateDailySummariesFlow } from '@/ai/flows/calculate-daily-summaries';
import { generateBingeCravingInsight } from '@/ai/flows/generate-binge-craving-insight';
import { FieldValue } from 'firebase-admin/firestore';


/**
 * Marks a coaching chat as "read" by the client by updating the lastClientMessage timestamp.
 */
export async function markChatAsRead(userId: string, chatId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!userId || !chatId) {
            throw new Error("User ID and Chat ID are required.");
        }
        const chatRef = adminDb.collection('chats').doc(chatId);
        await chatRef.update({ lastClientMessage: FieldValue.serverTimestamp() });
        return { success: true };
    } catch (error: any) {
        console.error("Error marking chat as read:", error);
        return { success: false, error: error.message };
    }
}


/**
 * Recalculates and resets a user's binge-free streak.
 * This function finds the last two binge events and sets the 'bingeFreeSince'
 * date to the timestamp of the second-to-last binge. If only one or zero
 * binges exist, it clears the streak.
 */
export async function resetBingeStreakAction(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!userId) {
            throw new Error("User ID is required.");
        }

        const clientRef = adminDb.collection('clients').doc(userId);
        
        // This query now correctly uses a field that is indexed by default with entryDate.
        const bingeQuery = adminDb.collection(`clients/${userId}/cravings`)
            .orderBy('entryDate', 'desc');

        const bingeSnapshot = await bingeQuery.get();
        
        // We must filter for binges in the code, as a composite index is not available.
        const bingeDocs = bingeSnapshot.docs.filter(doc => doc.data().type === 'binge');

        if (bingeDocs.length <= 1) {
            // If there's 1 or 0 binges, deleting it means the user has no binge history.
            // We should REMOVE the field, not set it to the creation date.
            // This signals to the UI that the streak card should not be displayed.
            await clientRef.update({
                bingeFreeSince: admin.firestore.FieldValue.delete(),
                lastBinge: admin.firestore.FieldValue.delete(),
            });
        } else {
            // The second document in our filtered list is the "new" last binge.
            const newLastBinge = bingeDocs[1].data();
            const newStreakStartDate = newLastBinge.entryDate;
            await clientRef.update({
                bingeFreeSince: newStreakStartDate,
                lastBinge: newStreakStartDate,
            });
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error resetting binge streak:", error);
        return { success: false, error: error.message };
    }
}


/**
 * Server Action to save data using the Admin SDK, bypassing client-side security rules.
 */
export async function saveDataAction(collectionName: string, data: any, userId: string, docId?: string) {
  try {
    if (!userId) throw new Error("User ID is required to save data.");

    let finalData = data.log;
    const settingsData = data.settings;

    // Convert ISO date strings back to Timestamps for Firestore
    if (finalData?.entryDate && typeof finalData.entryDate === 'string') {
        finalData.entryDate = admin.firestore.Timestamp.fromDate(new Date(finalData.entryDate));
    } else if (finalData?.entryDate instanceof Date) {
        finalData.entryDate = admin.firestore.Timestamp.fromDate(finalData.entryDate);
    }
    
    if (finalData?.wakeUpDay && typeof finalData.wakeUpDay === 'string') {
        finalData.wakeUpDay = admin.firestore.Timestamp.fromDate(new Date(finalData.wakeUpDay));
    } else if (finalData?.wakeUpDay instanceof Date) {
        finalData.wakeUpDay = admin.firestore.Timestamp.fromDate(finalData.wakeUpDay);
    }

    // This is the "Brain" logic. Determine the correct display pillar.
    let displayPillar: string;
    switch (collectionName) {
        case 'cravings':
            displayPillar = finalData.type; // 'craving' or 'binge'
            break;
        case 'stress':
            displayPillar = finalData.type === 'event' ? 'stress' : 'relief';
            break;
        case 'sleep':
            displayPillar = finalData.isNap ? 'sleep-nap' : 'sleep';
            break;
        default:
            displayPillar = collectionName;
            break;
    }
    
    // For nutrition, the summary is now pre-calculated on the client. We just pass it through.
    // The 'items' are also structured correctly by the client now.
    if (collectionName === 'nutrition' && finalData?.items) {
      finalData.items = finalData.items.map((item: any) => {
        // The client now sends the full food object plus quantity and unit
        // We can just pass it through, removing any client-side specific fields if necessary.
        const { ...foodData } = item;
        return foodData;
      });
    }
    
    const dataPath = `clients/${userId}/${collectionName}`;
    let savedDocId = docId;

    if (finalData && Object.keys(finalData).length > 0) {
        const fullDataToSave = {
            ...finalData,
            uid: userId,
            pillar: collectionName, 
            displayPillar: displayPillar, 
        };

        if (docId) {
            const docRef = adminDb.doc(`${dataPath}/${docId}`);
            await docRef.set({
                ...fullDataToSave,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        } else {
            const docRef = await adminDb.collection(dataPath).add({
                ...fullDataToSave,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            savedDocId = docRef.id;
        }
    }
    
    const clientRef = adminDb.doc(`clients/${userId}`);

    // If a binge is logged, update the client's binge timestamps. The summary and notification are handled by the flow.
    if (collectionName === 'cravings' && finalData?.type === 'binge') {
        const bingeTimestamp = finalData.entryDate;
        await clientRef.update({ 
            lastBinge: bingeTimestamp, 
            bingeFreeSince: bingeTimestamp 
        });
    }
    
    // Always trigger a summary recalculation after saving new data that affects it.
    if (['cravings', 'stress', 'nutrition', 'sleep', 'activity', 'hydration'].includes(collectionName)) {
        // IMPORTANT FIX: Removed `await` to make the UI feel instantaneous.
        // The summary will update in the background.
        calculateDailySummariesFlow({ clientId: userId, dryRun: false });
    }


    if (settingsData && Object.keys(settingsData).length > 0) {
         if (collectionName === 'hydration') {
             await clientRef.set({ hydrationSettings: settingsData }, { merge: true });
         }
    }

    await clientRef.update({ lastInteraction: admin.firestore.FieldValue.serverTimestamp() });
    
    // If a significant event is logged, call the appropriate insight generator.
    if (collectionName === 'cravings') {
        // IMPORTANT FIX: Call the fast, rule-based insight generator for immediate and relevant feedback.
        const insight = await generateBingeCravingInsight({
            logType: finalData.type,
            context: JSON.stringify({
                stress: finalData.stress,
                sleepLastNight: finalData.sleepLastNight,
                hydrationToday: finalData.hydrationToday,
            }),
        });
        
        // The output of the algorithmic function already matches the modal's expected props.
        const serializableInsight = {
            title: insight.title,
            message: insight.message,
            suggestion: insight.suggestion,
            logType: finalData.type, // Pass logType to the client for button logic
        };

        return { success: true, id: savedDocId, insight: serializableInsight };

    } else if (collectionName === 'stress' && finalData?.type === 'event') {
        // For stress events, we can still use the holistic insight if desired, or create another rule-based one.
        // For now, we'll keep the more detailed analysis for stress.
         const insight = await generateHolisticInsight({
            userId,
            periodInDays: 3,
            triggeringEvent: JSON.stringify(finalData),
        });
        if (insight) {
            const serializableInsight = {
                title: insight.title,
                message: insight.explanation, // Matching the modal's expected 'message' prop
                suggestion: insight.suggestion
            };
            return { success: true, id: savedDocId, insight: serializableInsight };
        }
    }

    return { success: true, id: savedDocId, insight: null };

  } catch (e: any) {
    console.error("Error in saveDataAction: ", e);
    return { success: false, error: e.message || "An unknown server error occurred." };
  }
}


export async function saveIndulgencePlanAction(planData: any, userId: string, docId?: string) {
    try {
        if (!userId) throw new Error("User ID is required.");
        const dataToSave = {
            ...planData,
            userId,
            indulgenceDate: admin.firestore.Timestamp.fromDate(new Date(planData.indulgenceDate)),
            displayPillar: 'planner' // Explicitly set for display
        };
        const collectionRef = adminDb.collection('indulgencePlans');
        if (docId) {
            await collectionRef.doc(docId).set({ ...dataToSave, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            return { success: true, id: docId };
        } else {
            const newDocRef = await collectionRef.add({ ...dataToSave, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            return { success: true, id: newDocRef.id };
        }
    } catch(e: any) {
        console.error("Error in saveIndulgencePlanAction:", e);
        return { success: false, error: e.message };
    }
}

interface LogChallengeProgressInput {
  userId: string;
  challengeId: string;
  date: string; // YYYY-MM-DD
  progress: Record<string, boolean | number>;
}

export async function logChallengeProgressAction(input: LogChallengeProgressInput) {
    const { userId, challengeId, date, progress } = input;
    try {
        const challengeRef = adminDb.collection('challenges').doc(challengeId);
        
        const updates: { [key: string]: any } = {};
        for (const taskDescription in progress) {
            const progressValue = progress[taskDescription];
            const progressFieldPath = `progress.${userId}.${date}.${taskDescription}`;
            updates[progressFieldPath] = progressValue;
        }

        await challengeRef.update(updates);
        
        // For simplicity, we won't generate an AI insight in this batch update model.
        // We could add it back by picking one of the tasks to generate an insight for.
        
        return { success: true, insight: null };

    } catch (error: any) {
        console.error('Error logging challenge progress:', error);
        return { success: false, error: error.message };
    }
}


export async function deleteData(collectionName: string, docId: string, userId: string) {
    try {
        if (!userId) throw new Error("User ID is required to delete data.");
        
        const dataPath = `clients/${userId}/${collectionName}`;
        const docRef = adminDb.doc(`${dataPath}/${docId}`);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
             console.warn(`Attempted to delete non-existent document: ${dataPath}/${docId}`);
             return { success: true };
        }
        
        const data = docSnap.data();

        await docRef.delete();
        
        // If the deleted item was a binge, trigger a streak recalculation.
        if (collectionName === 'cravings' && data?.type === 'binge') {
            await resetBingeStreakAction(userId);
        }
        
        // ** THE CRITICAL FIX **
        // Always trigger a summary recalculation after deleting data that affects it.
        if (['cravings', 'stress', 'nutrition', 'sleep', 'activity', 'hydration'].includes(collectionName)) {
            // No `await` here, let it run in the background.
            calculateDailySummariesFlow({ clientId: userId, dryRun: false });
        }


        return { success: true };
    } catch (e: any) {
        console.error("Error deleting document: ", e);
        return { success: false, error: e.message };
    }
}

const ALL_DATA_COLLECTIONS = [
    'nutrition', 'hydration', 'activity', 'sleep', 
    'stress', 'measurements', 'protocol', 'planner', 'cravings'
];

export async function getDataForDay(date: string, userId: string) {
    if (!userId) {
        console.log("No user ID provided for getDataForDay");
        return { success: true, data: [] };
    }

    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const startTimestamp = admin.firestore.Timestamp.fromDate(startOfDay);
    const endTimestamp = admin.firestore.Timestamp.fromDate(endOfDay);
    
    try {
        const promises = ALL_DATA_COLLECTIONS.map(collectionName => {
             const collectionPath = `clients/${userId}/${collectionName}`;
             
             if (collectionName === 'sleep') {
                 const q = adminDb.collection(collectionPath)
                    .where("wakeUpDay", ">=", startTimestamp)
                    .where("wakeUpDay", "<=", endTimestamp);
                 return q.get().then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, pillar: collectionName, ...doc.data() })));
             }
             
             const q = adminDb.collection(collectionPath)
                .where("entryDate", ">=", startTimestamp)
                .where("entryDate", "<=", endTimestamp);
                
            return q.get().then(snapshot => snapshot.docs.map(doc => ({
                id: doc.id,
                pillar: collectionName,
                ...doc.data()
            })));
        });

        const indulgencePlansPromise = adminDb.collection('indulgencePlans')
            .where('userId', '==', userId)
            .where('indulgenceDate', '>=', startTimestamp)
            .where('indulgenceDate', '<=', endTimestamp)
            .get().then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, pillar: 'planner', ...doc.data() })));

        const [results, indulgencePlans] = await Promise.all([Promise.all(promises), indulgencePlansPromise]);
        const allEntries = results.flat().concat(indulgencePlans);

        if (allEntries.length === 0) {
            return { success: true, data: [] };
        }
        
        allEntries.sort((a: any, b: any) => (a.entryDate as admin.firestore.Timestamp).toMillis() - (b.entryDate as admin.firestore.Timestamp).toMillis());

        const serializableData = allEntries.map(entry => {
            const newEntry = { ...entry };
            for(const key in newEntry) {
                if (newEntry[key] instanceof admin.firestore.Timestamp) {
                    newEntry[key] = newEntry[key].toDate();
                }
            }
            return newEntry;
        });

        return { success: true, data: serializableData };

    } catch(e: any) {
        console.error("Error getting documents: ", e);
        return { success: false, error: e, data: [] };
    }
}


export async function getAllDataForPeriod(days: number, userId: string, fromDate?: Date) {
    if (!userId) return { success: true, data: [] };

    const endDate = new Date();
    const startDate = fromDate ? startOfDay(new Date(fromDate)) : startOfDay(subDays(new Date(), days > 0 ? days - 1 : 0));
    
    const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
    const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);

    try {
        const promises = ALL_DATA_COLLECTIONS.map(collectionName => {
             const collectionPath = `clients/${userId}/${collectionName}`;
             let q: admin.firestore.Query;
             
             if (collectionName === 'sleep') {
                 q = adminDb.collection(collectionPath)
                    .where("wakeUpDay", ">=", startTimestamp)
                    .where("wakeUpDay", "<=", endTimestamp);
             } else if (collectionName === 'planner') {
                 // Planners are in a root collection, not nested under clients
                 q = adminDb.collection('indulgencePlans')
                    .where('userId', '==', userId)
                    .where("indulgenceDate", ">=", startTimestamp)
                    .where("indulgenceDate", "<=", endTimestamp);
             } else {
                 q = adminDb.collection(collectionPath)
                    .where("entryDate", ">=", startTimestamp)
                    .where("entryDate", "<=", endTimestamp);
             }
            return q.get().then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const results = await Promise.all(promises);
        const allEntries = results.flat();
        
        allEntries.sort((a: any, b: any) => {
            const dateA = a.entryDate || a.wakeUpDay || a.indulgenceDate;
            const dateB = b.entryDate || b.wakeUpDay || b.indulgenceDate;
            if (!dateA || !dateB) return 0;
            const timeA = dateA.toMillis ? dateA.toMillis() : new Date(dateA).getTime();
            const timeB = dateB.toMillis ? dateB.toMillis() : new Date(dateB).getTime();
            return timeB - timeA;
        });
        
        const serializableData = allEntries.map(entry => {
            const newEntry = { ...entry };
            for(const key in newEntry) {
                // This is the corrected check for a Firestore Timestamp
                if (newEntry[key] && typeof newEntry[key].toDate === 'function') {
                    newEntry[key] = newEntry[key].toDate().toISOString();
                }
            }
            return newEntry;
        });

        return { success: true, data: serializableData };

    } catch(e: any) {
        console.error("Error getting documents for period: ", e);
        return { success: false, error: e.message || 'Unknown error in getAllDataForPeriod', data: [] };
    }
}


export interface WeightDataPoint {
    entryDate: Date;
    weight: number;
    date: string;
}

export async function getWeightData(userId: string) {
    if (!userId) return { success: true, data: [] };
    
    try {
        const collectionPath = `clients/${userId}/measurements`;
        const q = adminDb.collection(collectionPath).orderBy('entryDate', 'asc');
        
        const querySnapshot = await q.get();
        const data = querySnapshot.docs
            .map(doc => {
                const docData = doc.data();
                // This is the fix: only process docs that have a valid, non-zero weight.
                if (docData.weight === undefined || docData.weight === null || Number(docData.weight) <= 0) {
                    return null;
                }
                return {
                    entryDate: docData.entryDate,
                    weight: Number(docData.weight),
                }
            })
            .filter((d): d is { entryDate: admin.firestore.Timestamp; weight: number } => d !== null);

         const serializableData = data.map(d => ({
            ...d,
            entryDate: d.entryDate.toDate()
        }));
        
        return { success: true, data: serializableData };
    } catch (e: any) {
        console.error("Error getting weight data: ", e);
        return { success: false, error: e, data: [] };
    }
}


export interface WthrDataPoint {
    entryDate: Date;
    wthr: number;
    date: string;
}

export async function getWthrData(userId: string) {
    if (!userId) return { success: true, data: [] };
    
    try {
        const collectionPath = `clients/${userId}/measurements`;
        const q = adminDb.collection(collectionPath).orderBy('entryDate', 'asc');
        
        const querySnapshot = await q.get();
        const data = querySnapshot.docs
            .map(doc => {
                const docData = doc.data();
                if (docData.wthr === undefined || docData.wthr === null) return null;
                return {
                    entryDate: docData.entryDate,
                    wthr: Number(docData.wthr),
                }
            })
            .filter((d): d is { entryDate: admin.firestore.Timestamp; wthr: number } => d !== null && !isNaN(d.wthr));

         const serializableData = data.map(d => ({
            ...d,
            entryDate: d.entryDate.toDate()
        }));
        
        return { success: true, data: serializableData };
    } catch (e: any) {
        console.error("Error getting WtHR data: ", e);
        return { success: false, error: e, data: [] };
    }
}


export interface Chat {
    id: string;
    name: string;
    description: string;
    type: 'coaching' | 'challenge' | 'open' | 'private_group';
    participants: string[];
    participantCount: number;
    createdAt?: admin.firestore.Timestamp;
    lastClientMessage?: admin.firestore.Timestamp;
    lastCoachMessage?: admin.firestore.Timestamp;
    lastAutomatedMessage?: admin.firestore.Timestamp;
    thumbnailUrl?: string;
    rules?: string[];
    ownerId?: string;
    lastMessage?: admin.firestore.Timestamp;
}

export interface Challenge {
    id: string;
    name: string;
    description: string;
    dates: { from: admin.firestore.Timestamp, to: admin.firestore.Timestamp };
    maxParticipants: number;
    trackables: any[];
    thumbnailUrl: string;
    participants: string[];
    participantCount: number;
    points?: { [key: string]: number };
    streaks?: { [key: string]: { lastLog: admin.firestore.Timestamp, count: number } };
    notes?: string;
    type: 'challenge';
    createdAt?: admin.firestore.Timestamp;
    scheduledPillars?: {
        pillarId: string;
        days: string[];
        recurrenceType: 'weekly' | 'custom';
        recurrenceInterval?: number;
        notes?: string;
    }[];
    scheduledHabits?: {
        habitId: string;
        days: string[];
        recurrenceType: 'weekly' | 'custom';
        recurrenceInterval?: number;
    }[];
    customTasks?: {
        description: string;
        startDay: number;
        unit: 'reps' | 'seconds' | 'minutes';
        goalType: 'static' | 'progressive' | 'user-records';
        goal?: number;
        startingGoal?: number;
        increaseBy?: number;
        increaseEvery?: 'week' | '2-weeks' | 'month';
        notes?: string;
    }[];
    progress?: {
        [userId: string]: {
            [date: string]: { // format: yyyy-MM-dd
                [taskDescription: string]: boolean | number;
            }
        }
    }
}


export async function getChallenges() {
    try {
        const q = adminDb.collection("challenges").orderBy("dates.from", "desc");
        const querySnapshot = await q.get();
        const challenges = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Challenge));
        return { success: true, data: challenges };
    } catch (error) {
        console.error("Fetching challenges: ", error);
        return { success: false, error, data: [] };
    }
}

export async function joinChallenge(challengeId: string, userId: string) {
    const challengeRef = adminDb.collection('challenges').doc(challengeId);
    const chatRef = adminDb.collection('chats').doc(challengeId);
    const userProfileRef = adminDb.collection('userProfiles').doc(userId);
    const clientRef = adminDb.collection('clients').doc(userId);

    try {
        await adminDb.runTransaction(async (transaction) => {
            const challengeDoc = await transaction.get(challengeRef);
            if (!challengeDoc.exists) throw "Challenge does not exist!";

            const clientDoc = await transaction.get(clientRef);
            const userName = clientDoc.exists ? clientDoc.data()?.fullName : 'A new user';
            
            const messagesCollectionRef = adminDb.collection(`chats/${challengeId}/messages`);

            transaction.update(challengeRef, {
                participants: admin.firestore.FieldValue.arrayUnion(userId),
                participantCount: admin.firestore.FieldValue.increment(1),
            });
             transaction.update(chatRef, {
                participants: admin.firestore.FieldValue.arrayUnion(userId),
                participantCount: admin.firestore.FieldValue.increment(1),
            });

            transaction.update(userProfileRef, {
                chatIds: admin.firestore.FieldValue.arrayUnion(challengeId),
            });

            transaction.set(messagesCollectionRef.doc(), {
                userId: 'system',
                userName: 'System',
                text: `${userName} has joined the challenge!`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                isSystemMessage: true,
            });
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error joining challenge: ", error);
        return { success: false, error: error.message };
    }
}


export async function joinChat(chatId: string, userId: string) {
    const chatRef = adminDb.collection('chats').doc(chatId);
    const userProfileRef = adminDb.collection('userProfiles').doc(userId);

    try {
        const userProfileSnap = await userProfileRef.get();
        if (!userProfileSnap.exists) {
            throw new Error("User profile not found.");
        }
        const userName = userProfileSnap.data()?.fullName || 'A new user';
        
        await adminDb.runTransaction(async (transaction) => {
            transaction.update(chatRef, {
                participants: admin.firestore.FieldValue.arrayUnion(userId),
                participantCount: admin.firestore.FieldValue.increment(1),
            });
            transaction.update(userProfileRef, {
                chatIds: admin.firestore.FieldValue.arrayUnion(chatId),
            });
             transaction.set(chatRef.collection('messages').doc(), {
                userId: 'system',
                userName: 'System',
                text: `${userName} has joined the chat!`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                isSystemMessage: true,
            });
        });
        return { success: true };
    } catch(error: any) {
         console.error("Error joining chat: ", error);
        return { success: false, error: error.message };
    }
}

export async function leaveChatAction(chatId: string, userId: string): Promise<{ success: boolean, error?: string }> {
    const chatRef = adminDb.collection('chats').doc(chatId);
    const userProfileRef = adminDb.collection('userProfiles').doc(userId);

    try {
        const userProfileSnap = await userProfileRef.get();
        if (!userProfileSnap.exists) {
            throw new Error("User profile not found.");
        }
        const userName = userProfileSnap.data()?.fullName || 'A user';

        await adminDb.runTransaction(async (transaction) => {
            transaction.update(chatRef, {
                participants: admin.firestore.FieldValue.arrayRemove(userId),
                participantCount: admin.firestore.FieldValue.increment(-1),
            });
            transaction.update(userProfileRef, {
                chatIds: admin.firestore.FieldValue.arrayRemove(chatId),
            });
            transaction.set(chatRef.collection('messages').doc(), {
                userId: 'system',
                userName: 'System',
                text: `${userName} has left the chat.`,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                isSystemMessage: true,
            });
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error leaving chat: ", error);
        return { success: false, error: error.message || "An unknown error occurred while leaving the chat." };
    }
}


export interface ChatMessage {
    id: string;
    text: string;
    userId: string;
    userName: string;
    timestamp: admin.firestore.Timestamp;
    isSystemMessage?: boolean;
    fileUrl?: string;
    fileName?: string;
}

export async function getUserChats(userId: string): Promise<{ success: boolean; data?: Chat[]; error?: any; }> {
    try {
        const userProfileRef = adminDb.collection('userProfiles').doc(userId);
        const userProfileSnap = await userProfileRef.get();

        if (!userProfileSnap.exists) {
             return { success: true, data: [] };
        }
       
        const userProfileData = userProfileSnap.data() as UserProfile;
        const chatIds = userProfileData.chatIds || [];

        if (chatIds.length === 0) {
            return { success: true, data: [] };
        }
        
        const allData: Chat[] = [];
        const MAX_IDS_PER_QUERY = 30;
        
        for (let i = 0; i < chatIds.length; i += MAX_IDS_PER_QUERY) {
            const chunk = chatIds.slice(i, i + MAX_IDS_PER_QUERY);
            if(chunk.length > 0) {
                const q = adminDb.collection('chats').where(admin.firestore.FieldPath.documentId(), 'in', chunk);
                const snapshot = await q.get();
                snapshot.forEach(docSnap => {
                    allData.push({ id: docSnap.id, ...docSnap.data() } as Chat);
                });
            }
        }
        
        allData.sort((a, b) => {
            const dateA = a.lastClientMessage || a.createdAt;
            const dateB = b.lastClientMessage || b.createdAt;
            if (dateA && dateB) {
                return (dateB as admin.firestore.Timestamp).toMillis() - (dateA as admin.firestore.Timestamp).toMillis();
            }
            return 0;
        });

        const serializableData = allData.map(chat => {
            const newChat = {...chat};
             for(const key in newChat) {
                if (newChat[key] instanceof admin.firestore.Timestamp) {
                    newChat[key] = newChat[key].toDate().toISOString();
                }
            }
            return newChat;
        });

        return { success: true, data: serializableData as any[] };
    } catch (error: any) {
        console.error("Error fetching user's chats: ", error);
        return { success: false, error: new Error(error.message || "An unknown error occurred") };
    }
}

export interface HabitHighlights {
    averageCalories: number | null;
    averageActivity: number | null;
    averageSleep: number | null;
    averageHydration: number | null;
    averageUpfScore: number | null;
    cravingsLogged: number;
    bingesLogged: number;
    stressEventsLogged: number;
}


export async function getHabitHighlights(userId: string, periodInDays: number): Promise<{ success: boolean; data?: HabitHighlights; error?: any; }> {
    try {
        const result = await getAllDataForPeriod(periodInDays, userId);
        if (!result.success || !result.data) {
            return { success: false, error: result.error || 'Failed to fetch data' };
        }
        const entries = result.data;
        
        const dailyData: Record<string, {
            calories: number,
            hydration: number,
            sleep: number,
            activity: number,
            upfScore: number,
            upfMeals: number,
        }> = {};

        // Initialize daily data
        for (let i = 0; i < periodInDays; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            dailyData[dateStr] = { calories: 0, hydration: 0, sleep: 0, activity: 0, upfScore: 0, upfMeals: 0 };
        }

        let cravingsLogged = 0;
        let bingesLogged = 0;
        let stressEventsLogged = 0;

        for (const entry of entries) {
            const entryDate = new Date(entry.entryDate || entry.wakeUpDay);
            const dateStr = entryDate.toISOString().split('T')[0];
            
            if (!dailyData[dateStr]) continue;

            if (entry.pillar === 'nutrition') {
                if (entry.summary?.allNutrients?.Energy?.value) {
                    dailyData[dateStr].calories += entry.summary.allNutrients.Energy.value;
                }
                if (entry.summary?.upf) {
                    dailyData[dateStr].upfScore += entry.summary.upf.score;
                    dailyData[dateStr].upfMeals++;
                }
            } else if (entry.pillar === 'hydration') {
                dailyData[dateStr].hydration += entry.amount || 0;
            } else if (entry.pillar === 'activity') {
                dailyData[dateStr].activity += entry.duration || 0;
            } else if (entry.pillar === 'sleep' && !entry.isNap) {
                dailyData[dateStr].sleep = entry.duration || 0;
            } else if (entry.pillar === 'cravings') {
                if (entry.type === 'craving') cravingsLogged++;
                if (entry.type === 'binge') bingesLogged++;
            } else if (entry.pillar === 'stress' && entry.type === 'event') {
                 stressEventsLogged++;
            }
        }
        
        const daysWithCalories = Object.values(dailyData).filter(d => d.calories > 0);
        const daysWithSleep = Object.values(dailyData).filter(d => d.sleep > 0);
        const daysWithHydration = Object.values(dailyData).filter(d => d.hydration > 0);
        const totalUpfMeals = Object.values(dailyData).reduce((acc, d) => acc + d.upfMeals, 0);

        const highlights: HabitHighlights = {
            averageCalories: daysWithCalories.length > 0 ? Object.values(dailyData).reduce((acc, d) => acc + d.calories, 0) / daysWithCalories.length : null,
            averageActivity: Object.values(dailyData).reduce((acc, d) => acc + d.activity, 0) / periodInDays,
            averageSleep: daysWithSleep.length > 0 ? Object.values(dailyData).reduce((acc, d) => acc + d.sleep, 0) / daysWithSleep.length : null,
            averageHydration: daysWithHydration.length > 0 ? Object.values(dailyData).reduce((acc, d) => acc + d.hydration, 0) / daysWithHydration.length : null,
            averageUpfScore: totalUpfMeals > 0 ? Object.values(dailyData).reduce((acc, d) => acc + d.upfScore, 0) / totalUpfMeals : null,
            cravingsLogged,
            bingesLogged,
            stressEventsLogged,
        };

        return { success: true, data: highlights };

    } catch (error: any) {
        console.error(`Error in getHabitHighlights for user ${userId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches all upcoming indulgence plans for a specific user.
 */
export async function getUpcomingIndulgences(userId: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    if (!userId) {
        return { success: false, error: "User ID is required." };
    }
    try {
        const now = admin.firestore.Timestamp.now();
        const q = adminDb.collection('indulgencePlans')
            .where('userId', '==', userId)
            .where('indulgenceDate', '>=', now)
            .orderBy('indulgenceDate', 'asc');

        const snapshot = await q.get();
        if (snapshot.empty) {
            return { success: true, data: [] };
        }

        const plans = snapshot.docs.map(doc => {
            const data = doc.data();
            // Serialize timestamps to ISO strings
            const serializableData: { [key: string]: any } = { id: doc.id };
            for (const key in data) {
                if (data[key] instanceof admin.firestore.Timestamp) {
                    serializableData[key] = data[key].toDate().toISOString();
                } else {
                    serializableData[key] = data[key];
                }
            }
            return serializableData;
        });

        return { success: true, data: plans };
    } catch (error: any) {
        console.error("Error fetching upcoming indulgences:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches and analyzes stress and hunger data from the last 24 hours
 * to provide a single, actionable "spotlight" insight.
 */
export async function getStressAndHungerSpotlight(userId: string): Promise<{
    success: boolean;
    data?: { icon: string; title: string; message: string; } | null;
    error?: string;
}> {
    if (!userId) return { success: false, error: "User ID is required." };

    try {
        const now = new Date();
        const twentyFourHoursAgo = subHours(now, 24);
        const startTimestamp = admin.firestore.Timestamp.fromDate(twentyFourHoursAgo);

        const cravingsPromise = adminDb.collection(`clients/${userId}/cravings`)
            .where('entryDate', '>=', startTimestamp).get();
        const stressPromise = adminDb.collection(`clients/${userId}/stress`)
            .where('type', '==', 'event')
            .where('entryDate', '>=', startTimestamp).get();
        
        const [cravingsSnapshot, stressSnapshot] = await Promise.all([cravingsPromise, stressPromise]);

        const cravings = cravingsSnapshot.docs.map(doc => doc.data());
        const stressEvents = stressSnapshot.docs.map(doc => doc.data());

        // --- Algorithmic Analysis ---
        const bingeEvents = cravings.filter(c => c.type === 'binge');
        if (bingeEvents.length > 0) {
            return {
                success: true,
                data: {
                    icon: 'HeartCrack',
                    title: 'Recent Binge Logged',
                    message: `A binge was logged in the last 24 hours. Take a moment for self-compassion and reflect on the potential triggers.`
                }
            };
        }

        const highStressEvents = stressEvents.filter(s => s.stressLevel >= 7);
        if (highStressEvents.length >= 2) {
            return {
                success: true,
                data: {
                    icon: 'ShieldAlert',
                    title: 'High Stress Pattern',
                    message: `You've logged multiple high-stress events recently. Remember to use your stress relief tools to prevent them from turning into cravings.`
                }
            };
        }

        const highHungerCravings = cravings.filter(c => c.hunger >= 7);
        if (highHungerCravings.length > 0) {
             return {
                success: true,
                data: {
                    icon: 'Apple',
                    title: 'Hunger & Cravings',
                    message: `A craving was logged when hunger was high. Ensure you're eating enough protein and fiber in your main meals to promote satiety.`
                }
            };
        }

        // If no significant negative patterns, return a positive reinforcement.
        return {
            success: true,
            data: {
                icon: 'Zap',
                title: 'Steady & Strong',
                message: 'No major stress or craving events were logged in the last 24 hours. Great job staying balanced and in control!'
            }
        };

    } catch (error: any) {
        console.error('Error getting stress and hunger spotlight:', error);
        return { success: false, error: error.message };
    }
}

    

    

    

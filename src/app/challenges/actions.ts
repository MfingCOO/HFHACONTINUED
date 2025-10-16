
'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import type { Challenge } from '@/services/firestore';
import { Timestamp } from 'firebase-admin/firestore';

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
 * Fetches all challenges for a client using the Admin SDK to bypass security rules.
 */
export async function getChallengesForClient(): Promise<{ success: boolean; data?: Challenge[]; error?: any; }> {
    try {
        const challengesQuery = adminDb.collection('challenges').orderBy("dates.from", "desc");
        const challengesSnapshot = await challengesQuery.get();
        
        const challenges = challengesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Challenge);
        const serializableData = challenges.map(serializeTimestamps);

        return { success: true, data: serializableData as Challenge[] };

    } catch (error: any) {
        console.error("Error fetching challenges for client (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}

/**
 * Fetches the latest active challenge, or the next upcoming challenge if none are active.
 */
export async function getLatestChallengeForClient(): Promise<{ success: boolean; data?: Challenge | null; error?: any; }> {
    try {
        const now = Timestamp.now();
        
        // 1. Look for an active challenge
        const activeQuery = adminDb.collection('challenges')
            .where("dates.from", "<=", now)
            .orderBy("dates.from", "desc");

        const activeSnapshot = await activeQuery.get();
        const activeChallengeDoc = activeSnapshot.docs.find(doc => {
            const data = doc.data();
            return data.dates.to.toMillis() >= now.toMillis();
        });

        if (activeChallengeDoc) {
            const challengeData = { id: activeChallengeDoc.id, ...activeChallengeDoc.data() };
            const serializableData = serializeTimestamps(challengeData);
            return { success: true, data: serializableData as Challenge };
        }

        // 2. If no active challenge, look for the next upcoming one
        const upcomingQuery = adminDb.collection('challenges')
            .where("dates.from", ">", now)
            .orderBy("dates.from", "asc")
            .limit(1);
            
        const upcomingSnapshot = await upcomingQuery.get();
        
        if (!upcomingSnapshot.empty) {
            const upcomingChallengeDoc = upcomingSnapshot.docs[0];
            const challengeData = { id: upcomingChallengeDoc.id, ...upcomingChallengeDoc.data() };
            const serializableData = serializeTimestamps(challengeData);
            return { success: true, data: serializableData as Challenge };
        }

        // 3. If no active or upcoming challenges are found
        return { success: true, data: null };

    } catch (error: any) {
        console.error("Error fetching latest challenge for client (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}

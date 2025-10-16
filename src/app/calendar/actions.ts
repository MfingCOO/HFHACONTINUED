
'use server';

import { db as adminDb, admin } from '@/lib/firebaseAdmin';
import { startOfDay, subDays } from 'date-fns';

const ALL_DATA_COLLECTIONS = [
    'nutrition', 'hydration', 'activity', 'sleep',
    'stress', 'measurements', 'protocol', 'planner', 'cravings'
];


/**
 * Recursively converts Firestore Timestamps within an object to ISO strings,
 * making the data safe to pass from Server Components to Client Components.
 */
function serializeTimestamps(data: any): any {
    if (!data) return data;
    if (data instanceof admin.firestore.Timestamp) {
        return data.toDate().toISOString();
    }
    if (Array.isArray(data)) {
        return data.map(serializeTimestamps);
    }
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
 * Fetches all log entries for a specific user on a given day.
 * This is a server action that uses admin privileges to securely access data.
 */
export async function getCalendarDataForDay(userId: string, date: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    if (!userId) {
        console.error("No user ID provided to getCalendarDataForDay");
        return { success: false, error: "User ID is required." };
    }

    // The date string is already in UTC yyyy-mm-dd format from the client.
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    // Convert to Firestore Timestamps for querying.
    const startTimestamp = admin.firestore.Timestamp.fromDate(startOfDay);
    const endTimestamp = admin.firestore.Timestamp.fromDate(endOfDay);

    try {
        const personalLogPromises = ALL_DATA_COLLECTIONS.map(collectionName => {
             const collectionPath = `clients/${userId}/${collectionName}`;
             
             // Sleep entries are queried by their wake-up day, not their start time.
             if (collectionName === 'sleep') {
                 const q = adminDb.collection(collectionPath)
                    .where("wakeUpDay", ">=", startTimestamp)
                    .where("wakeUpDay", "<=", endTimestamp);
                 return q.get().then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, pillar: collectionName, ...doc.data() })));
             }
             
             // All other entries are queried by their entry date.
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
            
        const coachAppointmentsPromise = adminDb.collection('coachCalendar')
            .where('clientId', '==', userId)
            .where('start', '>=', startTimestamp)
            .where('start', '<=', endTimestamp)
            .get().then(snapshot => 
                snapshot.docs.map(doc => {
                    const data = doc.data();
                    return { 
                        ...data, // This ensures all fields, including videoCallLink, are preserved.
                        id: doc.id, 
                        pillar: 'appointment', 
                        entryDate: data.start 
                    };
                })
            );


        const [personalLogs, indulgencePlans, coachAppointments] = await Promise.all([
            Promise.all(personalLogPromises), 
            indulgencePlansPromise,
            coachAppointmentsPromise,
        ]);
        
        const allEntries = (personalLogs as any).flat().concat(indulgencePlans as any).concat(coachAppointments as any);


        if (allEntries.length === 0) {
            return { success: true, data: [] };
        }
        
        allEntries.sort((a: any, b: any) => {
            const dateA = a.entryDate || a.wakeUpDay || a.indulgenceDate || a.start;
            const dateB = b.entryDate || b.wakeUpDay || b.indulgenceDate || b.start;
            if(!dateA || !dateB) return 0;
            return (dateA as admin.firestore.Timestamp).toMillis() - (dateB as admin.firestore.Timestamp).toMillis()
        });

        const serializableData = allEntries.map(serializeTimestamps);
        
        return { success: true, data: serializableData };

    } catch(e: any) {
        console.error("Error in getCalendarDataForDay: ", e);
        return { success: false, error: e.message || "An unknown server error occurred." };
    }
}


/**
 * Fetches contextual data for today, such as last night's sleep and today's hydration.
 */
export async function getTodaysContextualData(userId: string) {
    if (!userId) return null;

    const today = new Date();
    const startOfToday = startOfDay(today);
    const startOfYesterday = startOfDay(subDays(today, 1));
    const startTimestamp = admin.firestore.Timestamp.fromDate(startOfToday);

    try {
        const sleepPath = `clients/${userId}/sleep`;
        const hydrationPath = `clients/${userId}/hydration`;
        
        // Find sleep entry where wakeUpDay is today
        const sleepQuery = adminDb.collection(sleepPath)
            .where('wakeUpDay', '==', startTimestamp)
            .where('isNap', '==', false)
            .limit(1);

        // Find all hydration entries for today
        const hydrationQuery = adminDb.collection(hydrationPath)
            .where('entryDate', '>=', startTimestamp);

        const [sleepSnapshot, hydrationSnapshot] = await Promise.all([
            sleepQuery.get(),
            hydrationQuery.get()
        ]);

        let lastNightSleep = null;
        if (!sleepSnapshot.empty) {
            lastNightSleep = sleepSnapshot.docs[0].data().duration;
        }

        let todaysHydration = 0;
        if (!hydrationSnapshot.empty) {
            hydrationSnapshot.forEach(doc => {
                todaysHydration += doc.data().amount || 0;
            });
        }
        
        return {
            lastNightSleep,
            todaysHydration
        }

    } catch (error) {
        console.error("Error fetching contextual data: ", error);
        return null;
    }
}


'use server';

import { db as adminDb, admin } from '@/lib/firebaseAdmin';
import type { ClientProfile } from '@/types';

/**
 * Recursively converts Firestore Timestamps to ISO strings to make them serializable.
 * This is critical for nested objects like the `dailySummary`.
 */
function serializeTimestamps(data: any): any {
    if (!data) {
        return data;
    }
    if (data instanceof admin.firestore.Timestamp) {
        return data.toDate().toISOString();
    }
    if (Array.isArray(data)) {
        return data.map(serializeTimestamps);
    }
    if (typeof data === 'object') {
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
 * Fetches all clients for a coach using the Admin SDK to bypass security rules.
 */
export async function getClientsForCoach(): Promise<{ success: boolean; data?: ClientProfile[]; error?: any; }> {
    try {
        const clientsQuery = adminDb.collection('clients').orderBy("createdAt", "desc");
        const clientsSnapshot = await clientsQuery.get();
        
        const clients = clientsSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }) as ClientProfile);
        
        // Use the robust serializer here
        const serializableData = clients.map(serializeTimestamps);

        return { success: true, data: serializableData as ClientProfile[] };

    } catch (error: any) {
        console.error("Error fetching clients for coach (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}

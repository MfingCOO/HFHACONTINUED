
'use server';

import { db as adminDb, admin } from '@/lib/firebaseAdmin';
import { ClientProfile } from '@/types';

/**
 * Recursively converts Firestore Timestamps to ISO strings.
 */
function serializeTimestamps(docData: any) {
    if (!docData) return docData;
    const newObject: { [key: string]: any } = { ...docData };
    for (const key in newObject) {
      if (newObject[key] && typeof newObject[key].toDate === 'function') {
        newObject[key] = newObject[key].toDate().toISOString();
      } else if (typeof newObject[key] === 'object' && newObject[key] !== null && !Array.isArray(newObject[key])) {
          newObject[key] = serializeTimestamps(newObject[key]);
      }
    }
    return newObject;
}

// Note: The getHighWtHRClients and generatePopulationInsights functions have been removed
// as they created redundant data calculations. This logic is now centralized in the 
// dailySummary object on each client's profile, which is used by the "At-Risk Feed".

export interface PopulationInsight {
    title: string;
    finding: string;
    explanation: string;
    suggestion: string;
}

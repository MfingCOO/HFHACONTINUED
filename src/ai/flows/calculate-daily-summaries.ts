
'use server';
/**
 * @fileOverview This flow calculates a 7-day rolling summary of key metrics for a client.
 * It is designed to be triggered after a new data entry is logged.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db as adminDb, admin } from '@/lib/firebaseAdmin';
import { getAllDataForPeriod } from '@/services/firestore';
import { differenceInCalendarDays, startOfDay, subDays, isWithinInterval } from 'date-fns';
import type { ClientProfile } from '@/types';

const CalculateSummariesInputSchema = z.object({
  clientId: z.string().describe('The UID of the client to process.'),
  dryRun: z.boolean().optional().default(false),
});
export type CalculateSummariesInput = z.infer<typeof CalculateSummariesInputSchema>;

const CalculateSummariesOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  summary: z.any().optional(),
});
export type CalculateSummariesOutput = z.infer<typeof CalculateSummariesOutputSchema>;

export const calculateDailySummariesFlow = ai.defineFlow(
  {
    name: 'calculateDailySummariesFlow',
    inputSchema: CalculateSummariesInputSchema,
    outputSchema: CalculateSummariesOutputSchema,
  },
  async ({ clientId, dryRun }) => {
    console.log(`Starting daily summary calculation for client: ${clientId}`);
    const clientRef = adminDb.collection('clients').doc(clientId);
    
    // 1. Fetch client's basic data
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) {
        throw new Error(`Client ${clientId} not found.`);
    }
    const clientData = clientSnap.data() as ClientProfile;

    // 2. Fetch all relevant data for the last 7 days
    const result = await getAllDataForPeriod(7, clientId);
    if (!result.success || !result.data) {
        throw new Error(`Failed to fetch 7-day data for client ${clientId}.`);
    }
    const entries = result.data;
    
    // Define the 24-hour window for recent binge check
    const now = new Date();
    const twentyFourHoursAgo = subDays(now, 1);

    // 3. Initialize counters and aggregators
    let totalSleepHours = 0;
    let sleepDays = 0;
    let totalActivityMinutes = 0;
    let totalHydrationOz = 0;
    let hydrationDays = 0;
    let cravings = 0;
    let binges = 0;
    let stressEvents = 0;
    let totalUpfScore = 0;
    let upfMeals = 0;
    let recentBingeDetected = false;
    let mostRecentBingeTimestamp: admin.firestore.Timestamp | null = null;
    const nutrientTotals: Record<string, number> = {};

    // 4. Process each entry to build the summary
    for (const entry of entries) {
        if (entry.pillar === 'cravings') {
            if (entry.type === 'binge') {
                binges++;
                const bingeDate = new Date(entry.entryDate);
                if (isWithinInterval(bingeDate, { start: twentyFourHoursAgo, end: now })) {
                    recentBingeDetected = true;
                    const bingeTimestamp = admin.firestore.Timestamp.fromDate(bingeDate);
                    if (!mostRecentBingeTimestamp || bingeTimestamp.toMillis() > mostRecentBingeTimestamp.toMillis()) {
                         mostRecentBingeTimestamp = bingeTimestamp;
                    }
                }
            } else if (entry.type === 'craving') {
                cravings++;
            }
        } else if (entry.pillar === 'stress' && entry.type === 'event') {
            stressEvents++;
        }

        if (entry.pillar === 'sleep' && !entry.isNap) {
            totalSleepHours += entry.duration || 0;
            sleepDays++;
        }
        if (entry.pillar === 'activity') {
            totalActivityMinutes += entry.duration || 0;
        }
        if (entry.pillar === 'hydration') {
            totalHydrationOz += entry.amount || 0;
            hydrationDays++;
        }
        if (entry.pillar === 'nutrition' && entry.summary?.upf) {
            totalUpfScore += entry.summary.upf.score || 0;
            upfMeals++;
            
            if (entry.summary.nutrients) {
                for (const key in entry.summary.nutrients) {
                    nutrientTotals[key] = (nutrientTotals[key] || 0) + (entry.summary.nutrients[key].value || 0);
                }
            }
        }
    }
    
    // 5. Fetch weight and waist data for trend calculation
    const measurementsQuery = await clientRef.collection('measurements')
        .orderBy('entryDate', 'asc')
        .get();
        
    const weightData = measurementsQuery.docs.map(d => ({ weight: d.data().weight, date: d.data().entryDate.toDate() })).filter(d => d.weight);
    const waistData = measurementsQuery.docs.map(d => ({ waist: d.data().waist, date: d.data().entryDate.toDate() })).filter(d => d.waist);

    // 6. Assemble the final summary object
    const age = clientData.onboarding?.birthdate ? differenceInCalendarDays(new Date(), new Date(clientData.onboarding.birthdate)) / 365.25 : 0;
    
    const summary = {
        lastUpdated: admin.firestore.Timestamp.now(),
        age: Math.floor(age),
        sex: clientData.onboarding?.sex || 'unspecified',
        unit: clientData.onboarding?.units === 'metric' ? 'kg' : 'lbs',
        startWeight: weightData.length > 0 ? weightData[0].weight : null,
        currentWeight: weightData.length > 0 ? weightData[weightData.length - 1].weight : null,
        lastWeightDate: weightData.length > 0 ? weightData[weightData.length - 1].date.toISOString() : null,
        startWthr: clientData.wthr,
        currentWthr: clientData.wthr,
        lastWaistDate: waistData.length > 0 ? waistData[waistData.length - 1].date.toISOString() : null,
        avgSleep: sleepDays > 0 ? totalSleepHours / sleepDays : 0,
        avgActivity: totalActivityMinutes / 7,
        avgHydration: hydrationDays > 0 ? totalHydrationOz / hydrationDays : 0,
        cravings,
        binges,
        stressEvents,
        avgUpf: upfMeals > 0 ? totalUpfScore / upfMeals : 0,
        avgNutrients: {
            Energy: (nutrientTotals['Energy'] || 0) / 7,
            Protein: (nutrientTotals['Protein'] || 0) / 7,
            'Total lipid (fat)': (nutrientTotals['Total lipid (fat)'] || 0) / 7,
            'Carbohydrate, by difference': (nutrientTotals['Carbohydrate, by difference'] || 0) / 7,
        },
    };

    // 7. Save the summary to Firestore if not a dry run
    if (!dryRun) {
        await clientRef.set({ dailySummary: summary }, { merge: true });
        console.log(`Successfully updated daily summary for client: ${clientId}`);
    }

    return {
      success: true,
      message: `Summary calculated for client ${clientId}. ${dryRun ? '[DRY RUN]' : ''}`,
      summary,
    };
  }
);

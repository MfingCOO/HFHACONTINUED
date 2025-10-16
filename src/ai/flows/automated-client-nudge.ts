
'use server';
/**
 * @fileOverview This flow automatically nudges clients who have not interacted in a while.
 * It's designed to be run on a schedule (e.g., via a cron job).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { COACH_UIDS } from '@/lib/coaches';
import { postMessageAction } from '@/app/chats/actions';
import nudges from '@/lib/nudges.json';

const NudgeInputSchema = z.object({
  // This flow can be triggered without specific input,
  // but we can add parameters like a dryRun flag if needed.
  dryRun: z.boolean().optional().default(false),
});
export type NudgeInput = z.infer<typeof NudgeInputSchema>;

const NudgeOutputSchema = z.object({
  nudgedClients: z.array(z.object({
    chatId: z.string(),
    clientName: z.string(),
    message: z.string(),
  })),
  totalNudged: z.number(),
});
export type NudgeOutput = z.infer<typeof NudgeOutputSchema>;

export const automatedClientNudgeFlow = ai.defineFlow(
  {
    name: 'automatedClientNudgeFlow',
    inputSchema: NudgeInputSchema,
    outputSchema: NudgeOutputSchema,
  },
  async ({ dryRun }) => {
    console.log('Starting automated client nudge flow...');
    const now = Timestamp.now();
    const fortyEightHoursAgo = Timestamp.fromMillis(now.toMillis() - 48 * 60 * 60 * 1000);

    const chatsRef = adminDb.collection('chats');
    const q = chatsRef
      .where('type', '==', 'coaching')
      .where('lastClientMessage', '<=', fortyEightHoursAgo);
      
    const snapshot = await q.get();
    if (snapshot.empty) {
        console.log("No clients need nudging.");
        return { nudgedClients: [], totalNudged: 0 };
    }
    
    // Hard-coding Alan and Crystal as the designated senders.
    const coaches = [
        { uid: COACH_UIDS[0], name: "Alan Roberts" },
        { uid: COACH_UIDS[1], name: "Crystal Roberts" },
    ];
    
    const nudgedClients: NudgeOutput['nudgedClients'] = [];

    for (const chatDoc of snapshot.docs) {
        const chatData = chatDoc.data();
        const chatId = chatDoc.id;

        const lastClientMsgTimestamp = (chatData.lastClientMessage as Timestamp);
        const lastAutomatedMsgTimestamp = chatData.lastAutomatedMessage as Timestamp | undefined;
        
        // This is the core logic for the MIA queue.
        // A client is eligible for a nudge if:
        // 1. They have NEVER received an automated nudge OR
        // 2. Their last automated nudge is OLDER than their last message (meaning they replied and then went silent again) OR
        // 3. At least 24 hours have passed since the last automated nudge was sent.
        if (lastAutomatedMsgTimestamp) {
            const clientHasRepliedSinceLastNudge = lastClientMsgTimestamp.toMillis() > lastAutomatedMsgTimestamp.toMillis();
            if (clientHasRepliedSinceLastNudge) {
                // Client replied, so the 48-hour inactivity timer has already restarted for them via the main query.
                // We can proceed to nudge them.
            } else {
                 // The system has already nudged them and is waiting for a reply.
                 // We only send another nudge if it has been at least 24 hours.
                 const hoursSinceLastNudge = (now.toMillis() - lastAutomatedMsgTimestamp.toMillis()) / (1000 * 60 * 60);
                 if(hoursSinceLastNudge < 24) {
                    console.log(`Skipping ${chatData.name}, recently nudged ${hoursSinceLastNudge.toFixed(1)} hours ago.`);
                    continue;
                }
            }
        }
        
        const clientUid = chatData.participants.find((p: string) => !COACH_UIDS.includes(p));
        if (!clientUid) {
            console.warn(`Could not find client in chat ${chatId}`);
            continue;
        }

        // --- Algorithmic Nudge Generation ---
        // 1. Randomly select a coach to send the message
        const sendingCoach = coaches[Math.floor(Math.random() * coaches.length)];
        // 2. Randomly select a message from the JSON library
        const nudgeTemplate = nudges[Math.floor(Math.random() * nudges.length)];
        // 3. Format the message
        const messageText = nudgeTemplate
            .replace('{clientName}', chatData.name)
            .replace('{coachName}', sendingCoach.name.split(' ')[0]); // Use first name
        
        nudgedClients.push({
            chatId: chatId,
            clientName: chatData.name,
            message: messageText,
        });

        if (!dryRun) {
            console.log(`Sending nudge to ${chatData.name} in chat ${chatId}`);
            await postMessageAction({
                chatId: chatId,
                text: messageText,
                userId: sendingCoach.uid,
                userName: sendingCoach.name,
                isCoach: true,
                isAutomated: true, // This is the crucial flag
            });
        }
    }
    
    console.log(`Nudge flow complete. ${dryRun ? '[DRY RUN]' : ''} Nudged ${nudgedClients.length} clients.`);
    return { nudgedClients, totalNudged: nudgedClients.length };
  }
);


'use server';

import { db as adminDb, admin } from '@/lib/firebaseAdmin';
import type { Chat, UserProfile, ClientProfile, ChatMessage } from '@/types';
import { z } from 'zod';
import { COACH_UIDS } from '@/lib/coaches';
import { FieldValue } from 'firebase-admin/firestore';


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
 * Fetches all chats and all clients for a coach using the Admin SDK.
 * This is now combined to get all necessary data for filtering chats by client status.
 */
export async function getChatsAndClientsForCoach(): Promise<{ success: boolean; data?: { chats: Chat[], clients: ClientProfile[] }; error?: any; }> {
    try {
        const chatsQuery = adminDb.collection('chats').orderBy('createdAt', 'desc');
        const clientsQuery = adminDb.collection('clients').orderBy('createdAt', 'desc');

        const [chatsSnapshot, clientsSnapshot] = await Promise.all([
            chatsQuery.get(),
            clientsQuery.get()
        ]);
        
        const allChats = chatsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
        const allClients = clientsSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as ClientProfile));

        const serializableChats = allChats.map(serializeTimestamps);
        const serializableClients = allClients.map(serializeTimestamps);

        return { success: true, data: { chats: serializableChats as Chat[], clients: serializableClients as ClientProfile[] } };

    } catch (error: any) {
        console.error("Error fetching chats and clients for coach (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}


/**
 * For a client, fetches the chats they are a part of and all available 'open' chats.
 * This is a secure server action that uses admin privileges.
 */
export async function getChatsForClient(userId: string): Promise<{ success: boolean; data?: Chat[]; error?: any; }> {
    try {
        // 1. Fetch all 'open' chats that anyone can potentially join.
        const openChatsQuery = adminDb.collection('chats').where('type', '==', 'open');
        const openChatsPromise = openChatsQuery.get().then(snapshot => 
            snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat))
        );
        
        // 2. Fetch the user's specific chats via their profile.
        const userProfileRef = adminDb.collection('userProfiles').doc(userId);
        const userProfileSnap = await userProfileRef.get();
        
        let userChatIds: string[] = [];
        if (userProfileSnap.exists) {
            const userProfileData = userProfileSnap.data() as UserProfile;
            userChatIds = userProfileData.chatIds || [];
        }

        let userChats: Chat[] = [];
        if (userChatIds.length > 0) {
            // Firestore 'in' queries are limited to 30 items per query.
            // We chunk the array to handle users who might be in many chats.
            const MAX_IDS_PER_QUERY = 30; 
            for (let i = 0; i < userChatIds.length; i += MAX_IDS_PER_QUERY) {
                const chunk = userChatIds.slice(i, i + MAX_IDS_PER_QUERY);
                if(chunk.length > 0) {
                    const q = adminDb.collection('chats').where(admin.firestore.FieldPath.documentId(), 'in', chunk);
                    const snapshot = await q.get();
                    snapshot.forEach(docSnap => {
                        userChats.push({ id: docSnap.id, ...docSnap.data() } as Chat);
                    });
                }
            }
        }
        
        // 3. Combine the lists and remove duplicates.
        const [openChats] = await Promise.all([openChatsPromise]);
        const combinedChats = [...userChats, ...openChats];
        const uniqueChats = Array.from(new Map(combinedChats.map(chat => [chat.id, chat])).values());

        const serializableData = uniqueChats.map(serializeTimestamps);
        
        serializableData.sort((a: any, b: any) => {
            const dateA = new Date(a.lastClientMessage || a.lastMessage || a.createdAt || "0").getTime();
            const dateB = new Date(b.lastClientMessage || b.lastMessage || b.createdAt || "0").getTime();
            return dateB - dateA;
        });
        
        return { success: true, data: serializableData as Chat[] };
    } catch (error: any) {
        console.error("Error fetching user's chats (admin): ", error);
        return { success: false, error: { message: error.message || "An unknown admin error occurred" } };
    }
}


/**
 * Fetches details for a single chat using the Admin SDK.
 */
export async function getChatDetailsForCoach(chatId: string): Promise<{ success: boolean; data?: Chat; error?: any; }> {
    try {
        const docRef = adminDb.collection('chats').doc(chatId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = { id: docSnap.id, ...docSnap.data() };
            const serializableData = serializeTimestamps(data);
            return { success: true, data: serializableData as Chat };
        }
        return { success: false, error: 'Chat not found' };
    } catch (error: any) {
        console.error('Error getting chat details (admin):', error);
        return { success: false, error: { message: error.message || 'An unknown admin error occurred' } };
    }
}


/**
 * Securely fetches all messages for a given chat, now also including participant profiles.
 */
export async function getChatMessagesAction(chatId: string): Promise<{ success: boolean; data?: { messages: ChatMessage[], participants: Record<string, UserProfile> }; error?: string }> {
    try {
        const chatRef = adminDb.collection('chats').doc(chatId);
        const messagesRef = chatRef.collection('messages').orderBy('timestamp', 'asc');
        
        const [chatSnap, messagesSnap] = await Promise.all([chatRef.get(), messagesRef.get()]);

        if (!chatSnap.exists) {
            throw new Error("Chat not found.");
        }
        
        const chatData = chatSnap.data() as Chat;

        const messages = messagesSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timestamp: data.timestamp.toDate().toISOString(),
            };
        });

        const participants: Record<string, UserProfile> = {};
        if (chatData.participants && chatData.participants.length > 0) {
            const profilePromises = chatData.participants.map(uid => adminDb.collection('userProfiles').doc(uid).get());
            const profileSnapshots = await Promise.all(profilePromises);
            profileSnapshots.forEach(snap => {
                if (snap.exists) {
                    participants[snap.id] = snap.data() as UserProfile;
                }
            });
        }

        return { success: true, data: { messages: messages as ChatMessage[], participants } };

    } catch (error: any) {
        console.error(`Error fetching messages for chat ${chatId}:`, error);
        return { success: false, error: error.message };
    }
}


/**
 * Server action to generate a signed URL for a client-side file upload.
 * This is the new, correct way to handle file uploads.
 */
export async function getSignedUrlAction(fileName: string, path: string, contentType: string): Promise<{ success: boolean, signedUrl?: string, publicUrl?: string, error?: string }> {
  try {
    const bucket = admin.storage().bucket('gs://hunger-free-and-happy-app.firebasestorage.app');
    const uniqueFileName = `${path}/${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
    const file = bucket.file(uniqueFileName);

    // Generate a signed URL for PUT request.
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: contentType,
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;

    return { success: true, signedUrl, publicUrl };
  } catch (error: any) {
    console.error("Error generating signed URL via server action: ", error);
    return { success: false, error: error.message || 'Failed to generate signed URL.' };
  }
}


const PostMessageInputSchema = z.object({
  chatId: z.string(),
  text: z.string().optional(),
  userId: z.string(),
  userName: z.string(),
  isCoach: z.boolean(),
  isAutomated: z.boolean().optional(),
  // The file is no longer sent to this action. Instead, we just pass the final URL.
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
});

/**
 * Posts a message to a chat. This action now simply writes the message data,
 * including an optional fileUrl, to Firestore.
 */
export async function postMessageAction(input: z.infer<typeof PostMessageInputSchema>) {
    
    const { chatId, text, userId, userName, isCoach, isAutomated, fileUrl, fileName } = PostMessageInputSchema.parse(input);

    const chatDocRef = adminDb.collection('chats').doc(chatId);

    let chatData: Chat | null = null;
    
    try {
        await adminDb.runTransaction(async (transaction) => {
            const chatDoc = await transaction.get(chatDocRef);
            if (!chatDoc.exists) {
                throw new Error("Chat does not exist.");
            }
            chatData = chatDoc.data() as Chat;

            const messagesCollectionRef = chatDocRef.collection('messages');
            const messageData: any = {
                userId,
                userName,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                isSystemMessage: false,
            };
            
            if(text) messageData.text = text;
            if(fileUrl) messageData.fileUrl = fileUrl;
            if(fileName) messageData.fileName = fileName;


            transaction.set(messagesCollectionRef.doc(), messageData);

            // --- UNIVERSAL UPDATE LOGIC ---
            // The logic is now simplified to always update the same two fields.
            const updateData: { [key: string]: any } = {
              lastMessage: admin.firestore.FieldValue.serverTimestamp(),
              lastMessageSenderId: userId,
            };
            
            // For coaching chats, we also update the client/coach specific timestamps
            // to maintain logic around the "MIA" queue if needed.
            if (chatData?.type === 'coaching') {
                if (isAutomated) {
                    updateData.lastAutomatedMessage = admin.firestore.FieldValue.serverTimestamp();
                } else if (isCoach) {
                    updateData.lastCoachMessage = admin.firestore.FieldValue.serverTimestamp();
                } else {
                    updateData.lastClientMessage = admin.firestore.FieldValue.serverTimestamp();
                }
            }

            transaction.update(chatDocRef, updateData);
        });

        // --- NEW: Send Push Notifications after transaction succeeds ---
        if (chatData) {
            const recipients = chatData.participants.filter(pId => pId !== userId);
            if (recipients.length > 0) {
                const profilesSnap = await adminDb.collection('userProfiles').where(admin.firestore.FieldPath.documentId(), 'in', recipients).get();
                
                let tokens: string[] = [];
                profilesSnap.forEach(doc => {
                    const profile = doc.data() as UserProfile;
                    if (profile.fcmTokens && Array.isArray(profile.fcmTokens)) {
                        tokens.push(...profile.fcmTokens);
                    }
                });
                
                tokens = [...new Set(tokens)]; // Remove duplicates

                if (tokens.length > 0) {
                    const notificationPayload = {
                        notification: {
                            title: `New message from ${userName}`,
                            body: text || (fileName ? `Sent an attachment: ${fileName}` : 'Sent a message'),
                        },
                        data: {
                            chatId: chatId,
                            url: `/chats/${chatId}`
                        }
                    };
                    await admin.messaging().sendToDevice(tokens, notificationPayload);
                    console.log(`Sent chat notification to ${tokens.length} tokens for chat ${chatId}`);
                }
            }
        }
        
        return { success: true };

    } catch (error: any) {
        console.error(`Critical error in postMessageAction for chat ${chatId}:`, error);
        return { success: false, error: { message: error.message || `An unknown admin error occurred while posting message.` } };
    }
}


const DeleteMessageInputSchema = z.object({
  chatId: z.string(),
  messageId: z.string(),
  requesterId: z.string(),
});

/**
 * Deletes a message from a chat, checking for permissions first.
 * Only the message author or a coach can delete a message.
 */
export async function deleteMessageAction(input: z.infer<typeof DeleteMessageInputSchema>) {
    const { chatId, messageId, requesterId } = DeleteMessageInputSchema.parse(input);

    const messageRef = adminDb.collection('chats').doc(chatId).collection('messages').doc(messageId);

    try {
        const messageDoc = await messageRef.get();
        if (!messageDoc.exists) {
            throw new Error("Message not found.");
        }

        const messageData = messageDoc.data();
        const authorId = messageData?.userId;
        
        const isCoach = COACH_UIDS.includes(requesterId);
        const isAuthor = requesterId === authorId;

        if (!isCoach && !isAuthor) {
            throw new Error("You don't have permission to delete this message.");
        }
        
        await messageRef.delete();

        return { success: true };

    } catch (error: any) {
        console.error(`Error deleting message ${messageId} from chat ${chatId}:`, error);
        return { success: false, error: { message: error.message || "Could not delete message." } };
    }
}

/**
 * Deletes an entire chat and removes it from all participants' profiles.
 */
export async function deleteChatAction(chatId: string, requesterId: string) {
    if (!COACH_UIDS.includes(requesterId)) {
        return { success: false, error: "You don't have permission to perform this action." };
    }
    
    const chatRef = adminDb.collection('chats').doc(chatId);

    try {
        const chatDoc = await chatRef.get();
        if (!chatDoc.exists) {
            throw new Error("Chat not found.");
        }
        const chatData = chatDoc.data() as Chat;

        const batch = adminDb.batch();

        // Remove chat from all participants' profiles
        if (chatData.participants && chatData.participants.length > 0) {
            for (const uid of chatData.participants) {
                const userProfileRef = adminDb.collection('userProfiles').doc(uid);
                batch.update(userProfileRef, { chatIds: admin.firestore.FieldValue.arrayRemove(chatId) });
            }
        }
        
        // Delete the chat document itself
        batch.delete(chatRef);
        // Note: Deleting subcollections (messages) is best done via a Cloud Function extension.
        // For this scope, we just delete the main document.

        await batch.commit();
        return { success: true };

    } catch(error: any) {
        console.error("Error deleting chat:", error);
        return { success: false, error: error.message };
    }
}
    
const CreateChatInputSchema = z.object({
  name: z.string().min(3),
  description: z.string().min(10),
  type: z.enum(['open', 'private_group']),
  rules: z.string().optional(),
  participantIds: z.array(z.string()).optional(),
});

export async function createChatAction(input: z.infer<typeof CreateChatInputSchema>) {
    const { name, description, type, rules, participantIds = [] } = CreateChatInputSchema.parse(input);

    // Hardcoding the owner for simplicity as per the new strategy.
    // In a real app, this would come from the authenticated user session.
    const ownerId = COACH_UIDS[0]; 

    try {
        const batch = adminDb.batch();
        const chatRef = adminDb.collection('chats').doc();
        
        const participants = Array.from(new Set([ownerId, ...participantIds]));

        const chatData: Omit<Chat, 'id'> = {
            name,
            description,
            type,
            participants,
            participantCount: participants.length,
            ownerId,
            createdAt: admin.firestore.FieldValue.serverTimestamp() as any,
            rules: rules?.split('\n') || [],
        };
        
        batch.set(chatRef, chatData);
        
        const initialMessage = {
            userId: 'system',
            userName: 'System',
            text: `Chat "${name}" created by an admin.`,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            isSystemMessage: true,
        };
        const messageRef = chatRef.collection('messages').doc();
        batch.set(messageRef, initialMessage);

        for (const uid of participants) {
            const userProfileRef = adminDb.collection('userProfiles').doc(uid);
            batch.update(userProfileRef, { chatIds: FieldValue.arrayUnion(chatRef.id) });
        }

        await batch.commit();
        return { success: true };

    } catch (error: any) {
        console.error("Error in createChatAction:", error);
        return { success: false, error: error.message };
    }
}
    

    

  

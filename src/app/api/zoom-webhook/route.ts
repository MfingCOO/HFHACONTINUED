
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

// This function handles all incoming POST requests from Zoom.
export async function POST(req: NextRequest) {
    const zoomSecretToken = process.env.ZOOM_SECRET_TOKEN;

    // It's crucial to have the secret token configured.
    if (!zoomSecretToken) {
        console.error('CRITICAL: ZOOM_SECRET_TOKEN is not set in environment variables.');
        return new NextResponse('Webhook secret not configured on server.', { status: 500 });
    }

    // Read the raw request body as text for signature verification.
    // This cannot be skipped, as the JSON body might be parsed differently.
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    
    // --- Step 1: Handle Zoom's initial URL Validation Challenge ---
    // This event is sent only once when you add and validate the webhook URL.
    if (body.event === 'endpoint.url_validation') {
        try {
            // Create the HMAC-SHA256 hash of the plainToken using your secret token.
            const hash = crypto
                .createHmac('sha256', zoomSecretToken)
                .update(body.payload.plainToken)
                .digest('hex');
            
            // Respond to Zoom with the plainToken and the encryptedToken in the required JSON format.
            return NextResponse.json({
                plainToken: body.payload.plainToken,
                encryptedToken: hash,
            });
        } catch (error) {
            console.error('Error during Zoom URL validation:', error);
            return new NextResponse('Error during validation.', { status: 500 });
        }
    }

    // --- Step 2: Verify all other incoming event notifications ---
    // For every subsequent event (like a meeting being created), we must verify the signature.
    const signature = req.headers.get('x-zm-signature');
    const timestamp = req.headers.get('x-zm-request-timestamp');

    if (!signature || !timestamp) {
        console.warn('Webhook verification failed: Missing signature or timestamp header.');
        return new NextResponse('Forbidden: Missing required headers.', { status: 403 });
    }

    // Recreate the message string that Zoom used to create its signature.
    const message = `v0:${timestamp}:${rawBody}`;
    
    // Create our own signature using the same method.
    const expectedSignature = `v0=${crypto.createHmac('sha256', zoomSecretToken).update(message).digest('hex')}`;
    
    // Compare our signature with the one from Zoom. Use a timing-safe comparison to prevent timing attacks.
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        console.warn('Invalid Zoom webhook signature received.');
        return new NextResponse('Forbidden: Invalid signature.', { status: 401 });
    }

    // --- Step 3: Process the verified event ---
    try {
        if (body.event === 'scheduler.scheduled_event_created') {
            const { topic, start_time, end_time, invitees, agenda, host_email } = body.payload.object;
            
            // Find the client's email (assuming it's not the host's email).
            const clientEmail = invitees.find((invitee: { email: string; }) => invitee.email !== host_email)?.email;
            let clientId: string | null = null;
            
            if(clientEmail) {
                const clientQuery = await adminDb.collection('clients').where('email', '==', clientEmail).limit(1).get();
                if(!clientQuery.empty) {
                    clientId = clientQuery.docs[0].id;
                }
            }

            // Create a new event object for the coach's calendar.
            const calendarEvent = {
                id: uuidv4(),
                title: topic,
                start: new Date(start_time),
                end: new Date(end_time),
                description: agenda || 'Zoom meeting with coach.',
                attendees: invitees.map((invitee: { email: string; }) => invitee.email),
                clientId: clientId, // Link to the client if found
                isPersonal: false,
                createdAt: new Date(),
            };

            // Save the event to Firestore.
            await adminDb.collection('coachCalendar').doc(calendarEvent.id).set(calendarEvent);
            console.log(`Successfully created calendar event: ${calendarEvent.id} for client ${clientId}`);
        } else {
            console.log(`Received unhandled but verified Zoom event type: ${body.event}`);
        }

        // Acknowledge receipt of the webhook.
        return new NextResponse('Webhook processed successfully.', { status: 200 });

    } catch (error: any) {
        console.error('Error processing verified Zoom webhook:', error);
        return new NextResponse('Internal Server Error while processing event.', { status: 500 });
    }
}

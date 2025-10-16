
'use client';
import { storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

/**
 * Uploads a base64 encoded image to Firebase Storage and returns the public URL.
 * @param base64DataUrl The base64 data URL of the image to upload.
 * @param path The path in Firebase Storage to upload the file to.
 * @returns The public URL of the uploaded image.
 */
export async function uploadImage(base64DataUrl: string, path: string): Promise<string> {
    if (!base64DataUrl.startsWith('data:image')) {
        // If it's already a URL, just return it.
        if(base64DataUrl.startsWith('http')) return base64DataUrl;
        throw new Error('Invalid image data URL');
    }

    // Generate a unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.png`;
    const storageRef = ref(storage, `${path}/${fileName}`);
    
    // Extract the base64 part of the data URL
    const base64String = base64DataUrl.split(',')[1];

    try {
        // Upload the file
        const snapshot = await uploadString(storageRef, base64String, 'base64', {
            contentType: 'image/png'
        });

        // Get the public URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;

    } catch (error) {
        console.error("Error uploading image: ", error);
        throw new Error("Failed to upload image.");
    }
}

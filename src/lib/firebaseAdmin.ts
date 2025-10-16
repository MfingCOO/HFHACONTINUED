
import admin from 'firebase-admin';
// The import path is relative to the `out` directory, so we need to go up two levels.
import serviceAccount from '../../firebase-service-account-key.json';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      // Use the cert method to create a credential object
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
  } catch (error: any) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

const db = admin.firestore();
const auth = admin.auth();

export { db, auth, admin };

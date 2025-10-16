// Import the Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// This is the same Firebase configuration object from your app
const firebaseConfig = {
  "projectId": "hunger-free-and-happy-app",
  "appId": "1:1002580546718:web:a8574bfc3732c7c137978f",
  "storageBucket": "hunger-free-and-happy-app.appspot.com",
  "apiKey": "AIzaSyAk8vuQj8JfEyweNdtK9en9uUk6amEblYo",
  "authDomain": "hunger-free-and-happy-app.firebaseapp.com",
  "messagingSenderId": "1002580546718"
};

// Initialize the Firebase app in the service worker
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png' // You can add a default icon here
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

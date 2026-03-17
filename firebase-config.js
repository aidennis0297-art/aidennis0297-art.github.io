const firebaseConfig = {
  apiKey: "AIzaSyCltqqfdQfFAhzFJMUnRt9wUkj63pRaMOs",
  authDomain: "routineandremind.firebaseapp.com",
  projectId: "routineandremind",
  storageBucket: "routineandremind.firebasestorage.app",
  messagingSenderId: "160137475272",
  appId: "1:160137475272:web:d93ade06c15270f800a1fd",
  measurementId: "G-S6FE39J84G"
};

// Initialize Firebase (Compat SDK version 8.x for simpler flat scripts)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();

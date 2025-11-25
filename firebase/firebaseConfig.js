// firebase/firebaseConfig.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyD7DRb6kog1BhTDgp_WX7Qewkgg14eQeTA",
  authDomain: "aplicativo-62171.firebaseapp.com",
  databaseURL: "https://aplicativo-62171-default-rtdb.firebaseio.com",
  projectId: "aplicativo-62171",
  storageBucket: "aplicativo-62171.firebasestorage.app",
  messagingSenderId: "195455809564",
  appId: "1:195455809564:web:c8d62136da91d7498dc7d9",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const db = getDatabase(app);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export async function loginUser(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return { uid: user.uid, email: user.email };
}

export async function registerUser(email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  return { uid: user.uid, email: user.email };
}

export { app, db, auth };
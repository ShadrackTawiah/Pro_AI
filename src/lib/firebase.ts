import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBedi_QjPl-UzXPXC7wwLB73560VH0Nc1A",
  authDomain: "skofieldpro.firebaseapp.com",
  projectId: "skofieldpro",
  storageBucket: "skofieldpro.firebasestorage.app",
  messagingSenderId: "133495060524",
  appId: "1:133495060524:web:b37f3d316c9dc6bfd63989"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

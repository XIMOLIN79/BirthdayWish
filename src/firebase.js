import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCavW1oQMhbbK841S27WSRaN6k0ARx1-gI",
  authDomain: "birthdaywish-ae3c1.firebaseapp.com",
  databaseURL: "https://birthdaywish-ae3c1-default-rtdb.firebaseio.com",
  projectId: "birthdaywish-ae3c1",
  storageBucket: "birthdaywish-ae3c1.firebasestorage.app",
  messagingSenderId: "288908338363",
  appId: "1:288908338363:web:8b8682dd2a2c52ab14f59e",
};

const app = initializeApp(firebaseConfig);

const db = getDatabase(app);

export { db };
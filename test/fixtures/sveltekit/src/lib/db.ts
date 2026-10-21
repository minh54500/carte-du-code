// Firestore access.
import { collection, getDocs } from 'firebase/firestore';
const db = {};
export const orders = () => getDocs(collection(db, 'orders'));

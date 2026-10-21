// The orders collection.
import mongoose from 'mongoose';
export const Order = mongoose.model('Order', new mongoose.Schema({ total: Number }));
export const legacy = () => mongoose.connection.db.collection('legacy');

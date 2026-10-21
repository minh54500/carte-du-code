// The orders collection.
import mongoose from 'mongoose';
export const Order = mongoose.model('Order', new mongoose.Schema({ total: Number }));

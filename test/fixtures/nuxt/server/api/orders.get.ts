// Lists the orders.
import { Order } from '../models/order';
export default defineEventHandler(() => Order.find());

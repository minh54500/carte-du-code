import {
  soldOut,
  ok,
} from '../admin';
// Small helpers of the admin screen (a comment under a multi-line import).
export const wrap = (id: string) => soldOut(id).then(ok);

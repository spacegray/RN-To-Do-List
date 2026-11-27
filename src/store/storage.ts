import { randomUUID } from 'expo-crypto';

/** Short ID for things that never leave the device (toasts, saved colour sets). */
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** UUID for things that sync (tasks, notes): the database's ID format. */
export const uuid = () => randomUUID();

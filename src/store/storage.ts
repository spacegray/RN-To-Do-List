import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** One storage adapter for every persisted store (localStorage on web). */
export const storage = createJSONStorage(() => AsyncStorage);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

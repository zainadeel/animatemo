import { customAlphabet } from 'nanoid';

const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const newId = customAlphabet(alphabet, 8);

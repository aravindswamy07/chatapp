import { v4 as uuidv4 } from 'uuid';

export type User = {
  id: string;
  username: string;
  password: string;
};

// Simple in-memory storage - in a real app you'd use Supabase Auth or similar
let currentUser: User | null = null;

export function generateUserId() {
  return uuidv4();
}

export function login(username: string, password: string, userId: string) {
  currentUser = { id: userId, username, password };
  // Store in session storage for persistence across page refreshes
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
  }
  return currentUser;
}

export function getUserFromStorage() {
  if (typeof window !== 'undefined') {
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
      currentUser = JSON.parse(storedUser);
      return currentUser;
    }
  }
  return null;
}

export function getCurrentUser() {
  return currentUser || getUserFromStorage();
}

export function logout() {
  currentUser = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('currentUser');
  }
}

export function isLoggedIn() {
  return Boolean(getCurrentUser());
} 
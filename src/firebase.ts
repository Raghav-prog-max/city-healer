// Local mock implementation of Firebase SDK for City Healer Dedicated Backend Integration

export interface MockUser {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  tenantId: string | null;
  providerData: any[];
  getIdToken: () => Promise<string>;
}

class MockAuth {
  currentUser: MockUser | null = null;
  private listeners: ((user: MockUser | null) => void)[] = [];

  constructor() {
    this.loadSession();
  }

  private loadSession() {
    try {
      const savedUser = localStorage.getItem("city_healer_user");
      const savedToken = localStorage.getItem("city_healer_jwt");
      if (savedUser && savedToken) {
        const userObj = JSON.parse(savedUser);
        this.currentUser = {
          ...userObj,
          isAnonymous: false,
          tenantId: null,
          providerData: [],
          getIdToken: async () => savedToken
        };
      }
    } catch (e) {
      console.error("[MockAuth] Error loading session:", e);
    }
  }

  subscribe(callback: (user: MockUser | null) => void) {
    this.listeners.push(callback);
    // Immediately trigger with current state
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener(this.currentUser));
  }
}

export const auth = new MockAuth();
export const db = {};

export const browserLocalPersistence = "LOCAL";
export const browserSessionPersistence = "SESSION";

export async function setPersistence(authInst: any, persistenceType: any) {
  return Promise.resolve();
}

// Sign In
export async function signInWithEmailAndPassword(authInst: typeof auth, email: string, pass: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw {
      code: "auth/invalid-credential",
      message: errorData.error || "Invalid email or passcode."
    };
  }

  const data = await res.json();
  const token = data.token;
  const user = data.user;

  const mockUser: MockUser = {
    uid: user.uid,
    email: user.email,
    displayName: user.name,
    phoneNumber: user.phone || "",
    emailVerified: true,
    isAnonymous: false,
    tenantId: null,
    providerData: [],
    getIdToken: async () => token
  };

  localStorage.setItem("city_healer_jwt", token);
  localStorage.setItem("city_healer_user", JSON.stringify(user));
  authInst.currentUser = mockUser;
  authInst.notify();

  return { user: mockUser };
}

// Sign Up / Create User
export async function createUserWithEmailAndPassword(authInst: typeof auth, email: string, pass: string) {
  // Pass a placeholder name which will be updated by setDoc immediately afterwards
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass, name: "City Healer User" })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw {
      code: "auth/email-already-in-use",
      message: errorData.error || "Email already in use."
    };
  }

  // Registering automatically logs the user in briefly to trigger the profile setup
  return signInWithEmailAndPassword(authInst, email, pass);
}

// Sign Out
export async function signOut(authInst: typeof auth) {
  localStorage.removeItem("city_healer_jwt");
  localStorage.removeItem("city_healer_user");
  authInst.currentUser = null;
  authInst.notify();
  return Promise.resolve();
}

// Auth State Change listener
export function onAuthStateChanged(authInst: typeof auth, callback: (user: MockUser | null) => void) {
  return authInst.subscribe(callback);
}

export async function sendEmailVerification(user: any) {
  return Promise.resolve();
}

export async function sendPasswordResetEmail(authInst: any, email: string) {
  return Promise.resolve();
}

// Mock Google Sign-In
export async function signInWithPopup(authInst: typeof auth, provider: any) {
  try {
    return await signInWithEmailAndPassword(authInst, "google-user@cityhealer.com", "google-pass-123");
  } catch (err) {
    // If not exists, register first
    await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "google-user@cityhealer.com", password: "google-pass-123", name: "Google User", role: "PATIENT" })
    });
    return await signInWithEmailAndPassword(authInst, "google-user@cityhealer.com", "google-pass-123");
  }
}

export async function signInWithRedirect(authInst: any, provider: any) {
  return Promise.resolve();
}

export class GoogleAuthProvider {
  addScope(scope: string) {}
}

// Firestore Mock Functions
export interface MockDocRef {
  collection: string;
  id: string;
}

export function doc(dbInst: any, collectionName: string, id: string): MockDocRef {
  return { collection: collectionName, id };
}

export async function getDoc(docRef: MockDocRef) {
  const token = localStorage.getItem("city_healer_jwt");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`/api/users/${docRef.id}`, { headers });
  
  if (!res.ok) {
    return {
      exists: () => false,
      data: () => null
    };
  }

  const data = await res.json();
  return {
    exists: () => true,
    data: () => data
  };
}

export const getDocFromServer = getDoc;

export async function setDoc(docRef: MockDocRef, data: any) {
  const token = localStorage.getItem("city_healer_jwt");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`/api/users/${docRef.id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to update profile data on local backend.");
  }

  // Update locally stored user profile info
  const savedUserStr = localStorage.getItem("city_healer_user");
  if (savedUserStr) {
    try {
      const savedUser = JSON.parse(savedUserStr);
      const updatedUser = { ...savedUser, ...data };
      localStorage.setItem("city_healer_user", JSON.stringify(updatedUser));
      
      if (auth.currentUser && auth.currentUser.uid === docRef.id) {
        auth.currentUser = {
          ...auth.currentUser,
          displayName: updatedUser.name || auth.currentUser.displayName,
          phoneNumber: updatedUser.phone || auth.currentUser.phoneNumber
        };
        auth.notify();
      }
    } catch (e) {
      console.error("[setDoc] Error updating local user session storage:", e);
    }
  }

  return Promise.resolve();
}

export function serverTimestamp() {
  return new Date().toISOString();
}

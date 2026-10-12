import { supabase, SUPABASE_ENABLED } from "./supabase";

const STORAGE_KEY = "wd_local_users";
const REGISTRY_ID = "__geoflow_accounts__";

/**
 * Hash password using Web Crypto API PBKDF2 (SHA-256 with salt)
 */
export async function hashPassword(password, salt) {
  if (!password || !salt) return "";
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const keyBuffer = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 10000,
      hash: "SHA-256",
    },
    passwordKey,
    256
  );
  return Array.from(new Uint8Array(keyBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a cryptographically secure random salt hex string
 */
export function generateSalt() {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify plaintext password against stored salt and hash
 */
export async function verifyPassword(plainPassword, salt, storedHash) {
  if (!plainPassword || !salt || !storedHash) return false;
  const computedHash = await hashPassword(plainPassword, salt);
  return computedHash === storedHash;
}

/**
 * Retrieve accounts list from local storage cache
 */
export function getLocalAccounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save or update an account in local storage cache
 */
export function saveLocalAccount(account) {
  try {
    const list = getLocalAccounts();
    const updated = [
      ...list.filter((u) => (u.email || "").toLowerCase() !== account.email.toLowerCase()),
      account,
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Local account save error:", e);
  }
}

/**
 * Retrieve registered accounts from Supabase cloud registry
 */
export async function getCloudAccounts() {
  if (!SUPABASE_ENABLED || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("stages")
      .eq("id", REGISTRY_ID)
      .single();
    if (!error && Array.isArray(data?.stages)) {
      return data.stages;
    }
  } catch (e) {
    console.warn("Could not fetch cloud accounts:", e);
  }
  return [];
}

/**
 * Save or update an account in Supabase cloud registry
 */
export async function saveCloudAccount(account) {
  if (!SUPABASE_ENABLED || !supabase) return false;
  try {
    const cloudAccounts = await getCloudAccounts();
    const updated = [
      ...cloudAccounts.filter((u) => (u.email || "").toLowerCase() !== account.email.toLowerCase()),
      account,
    ];
    const { error } = await supabase
      .from("projects")
      .update({ stages: updated })
      .eq("id", REGISTRY_ID);
    if (!error) return true;
  } catch (e) {
    console.warn("Could not save cloud account:", e);
  }
  return false;
}

/**
 * Look up an account by email across local cache and cloud registry
 */
export async function findAccount(email) {
  const cleanEmail = (email || "").toLowerCase().trim();
  if (!cleanEmail) return null;

  // 1. Check local cache
  const localList = getLocalAccounts();
  const localFound = localList.find((u) => (u.email || "").toLowerCase() === cleanEmail);

  // 2. Check cloud registry
  const cloudList = await getCloudAccounts();
  const cloudFound = cloudList.find((u) => (u.email || "").toLowerCase() === cleanEmail);

  if (cloudFound) {
    saveLocalAccount(cloudFound);
    return cloudFound;
  }

  return localFound || null;
}

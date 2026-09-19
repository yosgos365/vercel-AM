import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { DonationDashboardData, DonationUser, PaymentMethod, Pledge } from "./src/donations/types";

const USERS = "donationUsers";
const PLEDGES = "donationPledges";
const SETTINGS = "donationSettings";

let firestorePromise: Promise<ReturnType<typeof getFirestore>> | null = null;

const asString = (value: unknown) => typeof value === "string" ? value.trim() : "";
const asTime = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : Date.now();
const asArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
const id = () => crypto.randomUUID();

async function donationFirestore() {
  if (firestorePromise) return firestorePromise;
  firestorePromise = (async () => {
    if (!getApps().length) {
      const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(process.cwd(), "firebase-service-account.json");
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || await fs.readFile(keyPath, "utf8");
      initializeApp({ credential: cert(JSON.parse(raw)) });
    }
    const firestore = getFirestore();
    firestore.settings({ ignoreUndefinedProperties: true });
    return firestore;
  })();
  return firestorePromise;
}

const donationUserFromData = (documentId: string, data: Record<string, unknown>): DonationUser => ({
  id: documentId,
  name: asString(data.name),
  phone: asString(data.phone),
  role: data.role === "admin" ? "admin" : "user",
  hebrewDob: data.hebrewDob && typeof data.hebrewDob === "object" ? data.hebrewDob as DonationUser["hebrewDob"] : undefined,
  familyMembers: asArray<DonationUser["familyMembers"][number]>(data.familyMembers),
  yahrzeits: asArray<DonationUser["yahrzeits"][number]>(data.yahrzeits),
  createdAt: asTime(data.createdAt),
  updatedAt: asTime(data.updatedAt),
});

const pledgeFromData = (documentId: string, data: Record<string, unknown>): Pledge => ({
  id: documentId,
  userId: asString(data.userId),
  type: asString(data.type),
  amount: Number(data.amount) || 0,
  date: asString(data.date),
  status: data.status === "paid" || data.status === "pending" ? data.status : "open",
  paymentMethod: data.paymentMethod === "paybox" || data.paymentMethod === "bank" || data.paymentMethod === "cash" ? data.paymentMethod : undefined,
  receiptImage: asString(data.receiptImage) || undefined,
  paidAt: asString(data.paidAt) || undefined,
  approvedAt: asString(data.approvedAt) || undefined,
  receiptNumber: asString(data.receiptNumber) || undefined,
  createdAt: asTime(data.createdAt),
  updatedAt: asTime(data.updatedAt),
});

const normalizedPhone = (phone: string) => phone.replace(/\D/g, "");
const isDonationPhone = (phone: string) => /^(?:05\d{8}|050)$/.test(normalizedPhone(phone));

export async function getDonationDashboard(): Promise<DonationDashboardData> {
  const db = await donationFirestore();
  const [users, pledges] = await Promise.all([
    db.collection(USERS).orderBy("name").get(),
    db.collection(PLEDGES).orderBy("createdAt", "desc").get(),
  ]);
  return {
    users: users.docs.map(document => donationUserFromData(document.id, document.data())),
    pledges: pledges.docs.map(document => pledgeFromData(document.id, document.data())),
  };
}

export async function findDonationUserByPhone(phone: string): Promise<DonationUser | null> {
  const normalized = normalizedPhone(phone);
  if (!normalized) return null;
  const db = await donationFirestore();
  const snapshot = await db.collection(USERS).where("phoneNormalized", "==", normalized).limit(1).get();
  return snapshot.empty ? null : donationUserFromData(snapshot.docs[0].id, snapshot.docs[0].data());
}

export async function createDonationUser(input: Pick<DonationUser, "name" | "phone"> & Partial<Pick<DonationUser, "role" | "hebrewDob" | "familyMembers" | "yahrzeits">>): Promise<DonationUser> {
  const name = asString(input.name);
  const phone = asString(input.phone);
  if (!name || !phone) throw new Error("יש למלא שם ומספר טלפון");
  if (!isDonationPhone(phone)) throw new Error("יש להזין מספר טלפון נייד תקין");
  const existing = await findDonationUserByPhone(phone);
  if (existing) throw new Error("כבר קיים מתפלל עם מספר הטלפון הזה");
  const now = Date.now();
  const user: DonationUser = {
    id: id(),
    name,
    phone,
    role: input.role === "admin" ? "admin" : "user",
    hebrewDob: input.hebrewDob,
    familyMembers: input.familyMembers || [],
    yahrzeits: input.yahrzeits || [],
    createdAt: now,
    updatedAt: now,
  };
  const db = await donationFirestore();
  await db.collection(USERS).doc(user.id).set({ ...user, phoneNormalized: normalizedPhone(phone) });
  return user;
}

export async function updateDonationUser(userId: string, changes: Partial<Pick<DonationUser, "name" | "phone" | "hebrewDob" | "familyMembers" | "yahrzeits">>): Promise<DonationUser> {
  const db = await donationFirestore();
  const reference = db.collection(USERS).doc(userId);
  const snapshot = await reference.get();
  if (!snapshot.exists) throw new Error("המתפלל לא נמצא");
  const current = donationUserFromData(snapshot.id, snapshot.data()!);
  const name = changes.name === undefined ? current.name : asString(changes.name);
  const phone = changes.phone === undefined ? current.phone : asString(changes.phone);
  if (!name || !phone) throw new Error("יש למלא שם ומספר טלפון");
  if (!isDonationPhone(phone)) throw new Error("יש להזין מספר טלפון נייד תקין");
  if (normalizedPhone(phone) !== normalizedPhone(current.phone)) {
    const conflicting = await findDonationUserByPhone(phone);
    if (conflicting && conflicting.id !== userId) throw new Error("כבר קיים מתפלל עם מספר הטלפון הזה");
  }
  const next: DonationUser = {
    ...current,
    ...changes,
    id: userId,
    name,
    phone,
    familyMembers: changes.familyMembers || current.familyMembers,
    yahrzeits: changes.yahrzeits || current.yahrzeits,
    updatedAt: Date.now(),
  };
  await reference.set({ ...next, phoneNormalized: normalizedPhone(phone) }, { merge: true });
  return next;
}

export async function deleteDonationUser(userId: string) {
  const db = await donationFirestore();
  const pledges = await db.collection(PLEDGES).where("userId", "==", userId).get();
  const batch = db.batch();
  batch.delete(db.collection(USERS).doc(userId));
  pledges.docs.forEach(pledge => batch.delete(pledge.ref));
  await batch.commit();
}

/** Removes one pledge. This is exposed only through the developer endpoint. */
export async function deleteDonationPledge(pledgeId: string): Promise<Pledge> {
  const db = await donationFirestore();
  const reference = db.collection(PLEDGES).doc(pledgeId);
  const snapshot = await reference.get();
  if (!snapshot.exists) throw new Error("ההתחייבות לא נמצאה");
  const pledge = pledgeFromData(snapshot.id, snapshot.data()!);
  await reference.delete();
  return pledge;
}

export async function createDonationPledge(input: { userId?: string; name: string; phone: string; type: string; amount: number; date?: string }): Promise<Pledge> {
  const name = asString(input.name);
  const phone = asString(input.phone);
  const type = asString(input.type) || "אחר";
  const amount = Number(input.amount);
  if (!name || !phone || !Number.isFinite(amount) || amount <= 0) throw new Error("יש למלא שם, טלפון וסכום תקין");
  if (!isDonationPhone(phone)) throw new Error("יש להזין מספר טלפון נייד תקין");
  let user = input.userId ? (await donationFirestore()).collection(USERS).doc(input.userId) : null;
  let userId = input.userId || "";
  if (!userId) {
    const found = await findDonationUserByPhone(phone);
    if (found) userId = found.id;
    else userId = (await createDonationUser({ name, phone })).id;
  }
  if (user && !(await user.get()).exists) throw new Error("המתפלל לא נמצא");
  const now = Date.now();
  const pledge: Pledge = {
    id: id(),
    userId,
    type,
    amount,
    date: input.date || new Date().toISOString().slice(0, 10),
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  const db = await donationFirestore();
  await db.collection(PLEDGES).doc(pledge.id).set(pledge);
  return pledge;
}

export async function markDonationPayment(pledgeIds: string[], paymentMethod: PaymentMethod, receiptImage?: string) {
  if (!pledgeIds.length) throw new Error("לא נבחרו התחייבויות לתשלום");
  const db = await donationFirestore();
  const now = new Date().toISOString();
  const batch = db.batch();
  for (const pledgeId of [...new Set(pledgeIds)]) {
    const reference = db.collection(PLEDGES).doc(pledgeId);
    const snapshot = await reference.get();
    if (!snapshot.exists) throw new Error("אחת ההתחייבויות לא נמצאה");
    const pledge = pledgeFromData(snapshot.id, snapshot.data()!);
    if (pledge.status !== "open") throw new Error("ניתן לדווח תשלום רק על התחייבות פתוחה");
    batch.update(reference, { status: "pending", paymentMethod, receiptImage, paidAt: now, updatedAt: Date.now() });
  }
  await batch.commit();
}

export async function approveDonationPledge(pledgeId: string): Promise<Pledge> {
  const db = await donationFirestore();
  const reference = db.collection(PLEDGES).doc(pledgeId);
  let approved: Pledge | null = null;
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new Error("ההתחייבות לא נמצאה");
    const pledge = pledgeFromData(snapshot.id, snapshot.data()!);
    if (pledge.status !== "pending") throw new Error("ניתן לאשר רק התחייבות שממתינה לאישור");
    const settings = db.collection(SETTINGS).doc("receiptCounter");
    const settingsSnapshot = await transaction.get(settings);
    const nextNumber = Number(settingsSnapshot.data()?.lastNumber || 10000) + 1;
    const approvedAt = new Date().toISOString();
    approved = { ...pledge, status: "paid", approvedAt, receiptNumber: String(nextNumber), updatedAt: Date.now() };
    transaction.update(reference, { status: "paid", approvedAt, receiptNumber: String(nextNumber), updatedAt: approved.updatedAt });
    transaction.set(settings, { lastNumber: nextNumber, updatedAt: Date.now() }, { merge: true });
  });
  return approved!;
}

export async function getDonationPledgesForUser(userId: string) {
  const db = await donationFirestore();
  const snapshot = await db.collection(PLEDGES).where("userId", "==", userId).get();
  return snapshot.docs.map(document => pledgeFromData(document.id, document.data())).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getDonationUser(userId: string) {
  const db = await donationFirestore();
  const snapshot = await db.collection(USERS).doc(userId).get();
  return snapshot.exists ? donationUserFromData(snapshot.id, snapshot.data()!) : null;
}

export async function donationCollectionsReady() {
  const db = await donationFirestore();
  await db.collection(SETTINGS).doc("system").set({ initializedAt: FieldValue.serverTimestamp() }, { merge: true });
}

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { DonationDashboardData, DonationUser, PaymentMethod, Pledge } from "./src/donations/types";

const USERS = "donationUsers";
const PLEDGES = "donationPledges";
const SETTINGS = "donationSettings";
// A separate document per normalized number makes the uniqueness check work
// even when two registrations reach Firestore at exactly the same time.
const PHONE_INDEX = "donationPhoneIndex";
const BACKUPS = "donationBackups";
const BACKUP_RETENTION_DAYS = 365;

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
    // The seating database may already have obtained this shared Admin SDK
    // Firestore instance. Calling settings() again after that first use makes
    // the local server crash, so keep this module configuration-free.
    return getFirestore();
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
  paymentBatchId: asString(data.paymentBatchId) || undefined,
  receiptPledgeIds: asArray<string>(data.receiptPledgeIds).filter((value) => typeof value === "string"),
  approvalNote: asString(data.approvalNote) || undefined,
  createdAt: asTime(data.createdAt),
  updatedAt: asTime(data.updatedAt),
});

const normalizedPhone = (phone: string) => phone.replace(/\D/g, "");
const isDonationPhone = (phone: string) => /^(?:05\d{8}|050)$/.test(normalizedPhone(phone));
const phoneIndexId = (phone: string) => crypto.createHash("sha256").update(normalizedPhone(phone)).digest("hex");

type ReceiptBackupCopier = (receiptImage: string, pledgeId: string) => Promise<string>;

const commitWrites = async (db: Awaited<ReturnType<typeof donationFirestore>>, writes: Array<(batch: ReturnType<typeof db.batch>) => void>) => {
  for (let start = 0; start < writes.length; start += 400) {
    const batch = db.batch();
    writes.slice(start, start + 400).forEach((write) => write(batch));
    await batch.commit();
  }
};

const clearBackup = async (db: Awaited<ReturnType<typeof donationFirestore>>, reference: FirebaseFirestore.DocumentReference) => {
  for (const collectionName of ["users", "pledges", "settings"]) {
    const snapshot = await reference.collection(collectionName).get();
    await commitWrites(db, snapshot.docs.map((document) => (batch) => batch.delete(document.ref)));
  }
  await reference.delete();
};

/**
 * Saves a separate, restorable snapshot of every donation record. Receipt
 * images can be copied by the server callback into protected backup storage.
 */
export async function createDonationBackup(backupId: string, date: string, copyReceiptImage?: ReceiptBackupCopier) {
  const db = await donationFirestore();
  const reference = db.collection(BACKUPS).doc(backupId);
  const existing = await reference.get();
  if (existing.data()?.status === "complete") return existing.data();
  if (existing.exists) await clearBackup(db, reference);

  const [users, pledges, settings] = await Promise.all([
    db.collection(USERS).get(),
    db.collection(PLEDGES).get(),
    db.collection(SETTINGS).get(),
  ]);
  const pledgeData = await Promise.all(pledges.docs.map(async (document) => {
    const data = { ...document.data() };
    if (copyReceiptImage && typeof data.receiptImage === "string" && data.receiptImage) {
      data.receiptImage = await copyReceiptImage(data.receiptImage, document.id);
    }
    return { id: document.id, data };
  }));

  await reference.set({ id: backupId, date, timestamp: Date.now(), status: "writing" });
  await commitWrites(db, [
    ...users.docs.map((document) => (batch) => batch.set(reference.collection("users").doc(document.id), document.data())),
    ...pledgeData.map((document) => (batch) => batch.set(reference.collection("pledges").doc(document.id), document.data)),
    ...settings.docs.map((document) => (batch) => batch.set(reference.collection("settings").doc(document.id), document.data())),
  ]);
  const complete = { id: backupId, date, timestamp: Date.now(), status: "complete", usersCount: users.size, pledgesCount: pledges.size };
  await reference.set(complete, { merge: true });

  const allBackups = await db.collection(BACKUPS).orderBy("timestamp", "desc").get();
  for (const oldBackup of allBackups.docs.slice(BACKUP_RETENTION_DAYS)) await clearBackup(db, oldBackup.ref);
  return complete;
}

/** Restores donation users, pledges, receipt counter and protected image references from one snapshot. */
export async function restoreDonationBackup(backupId: string) {
  const db = await donationFirestore();
  const reference = db.collection(BACKUPS).doc(backupId);
  const metadata = await reference.get();
  if (metadata.data()?.status !== "complete") throw new Error("גיבוי הנדרים אינו זמין");
  const [backupUsers, backupPledges, backupSettings, currentUsers, currentPledges, currentSettings, currentIndex] = await Promise.all([
    reference.collection("users").get(),
    reference.collection("pledges").get(),
    reference.collection("settings").get(),
    db.collection(USERS).get(),
    db.collection(PLEDGES).get(),
    db.collection(SETTINGS).get(),
    db.collection(PHONE_INDEX).get(),
  ]);
  await commitWrites(db, [
    ...currentUsers.docs.map((document) => (batch) => batch.delete(document.ref)),
    ...currentPledges.docs.map((document) => (batch) => batch.delete(document.ref)),
    ...currentSettings.docs.map((document) => (batch) => batch.delete(document.ref)),
    ...currentIndex.docs.map((document) => (batch) => batch.delete(document.ref)),
    ...backupUsers.docs.map((document) => (batch) => {
      const data = document.data();
      batch.set(db.collection(USERS).doc(document.id), data);
      const phone = asString(data.phone);
      if (phone) batch.set(db.collection(PHONE_INDEX).doc(phoneIndexId(phone)), { userId: document.id, phoneNormalized: normalizedPhone(phone), restoredAt: Date.now() });
    }),
    ...backupPledges.docs.map((document) => (batch) => batch.set(db.collection(PLEDGES).doc(document.id), document.data())),
    ...backupSettings.docs.map((document) => (batch) => batch.set(db.collection(SETTINGS).doc(document.id), document.data())),
  ]);
}

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
  const indexed = await db.collection(PHONE_INDEX).doc(phoneIndexId(phone)).get();
  const indexedUserId = asString(indexed.data()?.userId);
  if (indexed.exists && indexedUserId) {
    const user = await db.collection(USERS).doc(indexedUserId).get();
    if (user.exists) return donationUserFromData(user.id, user.data()!);
  }
  // Existing records created before the phone index was added remain
  // discoverable. Any subsequent edit or new registration creates the index.
  const snapshot = await db.collection(USERS).where("phoneNormalized", "==", normalized).limit(1).get();
  return snapshot.empty ? null : donationUserFromData(snapshot.docs[0].id, snapshot.docs[0].data());
}

export async function createDonationUser(input: Pick<DonationUser, "name" | "phone"> & Partial<Pick<DonationUser, "role" | "hebrewDob" | "familyMembers" | "yahrzeits">>): Promise<DonationUser> {
  const name = asString(input.name);
  const phone = asString(input.phone);
  if (!name || !phone) throw new Error("יש למלא שם ומספר טלפון");
  if (!isDonationPhone(phone)) throw new Error("יש להזין מספר טלפון נייד תקין");
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
  const userReference = db.collection(USERS).doc(user.id);
  const indexReference = db.collection(PHONE_INDEX).doc(phoneIndexId(phone));
  const existingByPhone = db.collection(USERS).where("phoneNormalized", "==", normalizedPhone(phone)).limit(1);
  await db.runTransaction(async transaction => {
    const [indexSnapshot, usersSnapshot] = await Promise.all([
      transaction.get(indexReference),
      transaction.get(existingByPhone),
    ]);
    if (indexSnapshot.exists || !usersSnapshot.empty) throw new Error("כבר קיים מתפלל עם מספר הטלפון הזה");
    transaction.set(userReference, { ...user, phoneNormalized: normalizedPhone(phone) });
    transaction.set(indexReference, { userId: user.id, phoneNormalized: normalizedPhone(phone), createdAt: now });
  });
  return user;
}

export async function updateDonationUser(userId: string, changes: Partial<Pick<DonationUser, "name" | "phone" | "hebrewDob" | "familyMembers" | "yahrzeits">>): Promise<DonationUser> {
  const db = await donationFirestore();
  const reference = db.collection(USERS).doc(userId);
  let next: DonationUser | null = null;
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new Error("המתפלל לא נמצא");
    const current = donationUserFromData(snapshot.id, snapshot.data()!);
    const name = changes.name === undefined ? current.name : asString(changes.name);
    const phone = changes.phone === undefined ? current.phone : asString(changes.phone);
    if (!name) throw new Error("יש למלא שם מתפלל");
    if (phone && !isDonationPhone(phone)) throw new Error("יש להזין מספר טלפון נייד תקין");
    const oldPhone = normalizedPhone(current.phone);
    const newPhone = normalizedPhone(phone);
    const newIndexReference = phone ? db.collection(PHONE_INDEX).doc(phoneIndexId(phone)) : null;
    if (newPhone !== oldPhone) {
      if (newPhone && newIndexReference) {
        const [indexSnapshot, matchingUsers] = await Promise.all([
          transaction.get(newIndexReference),
          transaction.get(db.collection(USERS).where("phoneNormalized", "==", newPhone).limit(1)),
        ]);
        const indexedUser = asString(indexSnapshot.data()?.userId);
        if ((indexSnapshot.exists && indexedUser !== userId) || matchingUsers.docs.some(document => document.id !== userId)) {
          throw new Error("כבר קיים מתפלל עם מספר הטלפון הזה");
        }
      }
      if (oldPhone) {
        const oldIndexReference = db.collection(PHONE_INDEX).doc(phoneIndexId(current.phone));
        const oldIndex = await transaction.get(oldIndexReference);
        if (oldIndex.exists && asString(oldIndex.data()?.userId) === userId) transaction.delete(oldIndexReference);
      }
      if (newPhone && newIndexReference) transaction.set(newIndexReference, { userId, phoneNormalized: newPhone, updatedAt: Date.now() });
    } else if (newPhone && newIndexReference) {
      // Backfill the index for records created before this protection existed.
      transaction.set(newIndexReference, { userId, phoneNormalized: newPhone, updatedAt: Date.now() }, { merge: true });
    }
    next = {
      ...current,
      ...changes,
      id: userId,
      name,
      phone,
      familyMembers: changes.familyMembers || current.familyMembers,
      yahrzeits: changes.yahrzeits || current.yahrzeits,
      updatedAt: Date.now(),
    };
    transaction.set(reference, { ...next, phoneNormalized: newPhone }, { merge: true });
  });
  return next!;
}

export async function deleteDonationUser(userId: string) {
  const db = await donationFirestore();
  const user = await db.collection(USERS).doc(userId).get();
  const pledges = await db.collection(PLEDGES).where("userId", "==", userId).get();
  const batch = db.batch();
  batch.delete(db.collection(USERS).doc(userId));
  if (user.exists) batch.delete(db.collection(PHONE_INDEX).doc(phoneIndexId(asString(user.data()?.phone))));
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

export async function createDonationPledge(input: { userId?: string; name: string; phone: string; type: string; amount: number; date?: string; approvalNote?: string }): Promise<Pledge> {
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
    approvalNote: asString(input.approvalNote).slice(0, 500) || undefined,
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
  const paymentBatchId = id();
  const batch = db.batch();
  for (const pledgeId of [...new Set(pledgeIds)]) {
    const reference = db.collection(PLEDGES).doc(pledgeId);
    const snapshot = await reference.get();
    if (!snapshot.exists) throw new Error("אחת ההתחייבויות לא נמצאה");
    const pledge = pledgeFromData(snapshot.id, snapshot.data()!);
    if (pledge.status !== "open") throw new Error("ניתן לדווח תשלום רק על התחייבות פתוחה");
    batch.update(reference, { status: "pending", paymentMethod, receiptImage, paidAt: now, paymentBatchId, updatedAt: Date.now() });
  }
  await batch.commit();
}

export async function approveDonationPledge(pledgeId: string, approvalNote = ""): Promise<Pledge> {
  const db = await donationFirestore();
  const reference = db.collection(PLEDGES).doc(pledgeId);
  let approved: Pledge | null = null;
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new Error("ההתחייבות לא נמצאה");
    const pledge = pledgeFromData(snapshot.id, snapshot.data()!);
    if (pledge.status !== "pending") throw new Error("ניתן לאשר רק התחייבות שממתינה לאישור");
    const paymentBatch = pledge.paymentBatchId
      ? await transaction.get(db.collection(PLEDGES).where("paymentBatchId", "==", pledge.paymentBatchId))
      : null;
    const related = paymentBatch
      ? paymentBatch.docs.map(document => pledgeFromData(document.id, document.data())).filter(item => item.status === "pending")
      : [pledge];
    const receiptPledgeIds = related.map(item => item.id);
    const settings = db.collection(SETTINGS).doc("receiptCounter");
    const settingsSnapshot = await transaction.get(settings);
    const nextNumber = Number(settingsSnapshot.data()?.lastNumber || 10000) + 1;
    const approvedAt = new Date().toISOString();
    const updatedAt = Date.now();
    for (const relatedPledge of related) {
      transaction.update(db.collection(PLEDGES).doc(relatedPledge.id), {
        status: "paid",
        approvedAt,
        receiptNumber: String(nextNumber),
        receiptPledgeIds,
        ...(relatedPledge.id === pledgeId ? { approvalNote: approvalNote || FieldValue.delete() } : {}),
        updatedAt,
      });
    }
    approved = { ...pledge, status: "paid", approvedAt, receiptNumber: String(nextNumber), receiptPledgeIds, approvalNote: approvalNote || pledge.approvalNote, updatedAt };
    transaction.set(settings, { lastNumber: nextNumber, updatedAt: Date.now() }, { merge: true });
  });
  return approved!;
}

/** A manager can keep an internal note on every pledge, before or after payment. */
export async function updateDonationPledgeNote(pledgeId: string, approvalNote: string): Promise<Pledge> {
  const db = await donationFirestore();
  const reference = db.collection(PLEDGES).doc(pledgeId);
  const snapshot = await reference.get();
  if (!snapshot.exists) throw new Error("ההתחייבות לא נמצאה");
  const note = approvalNote.trim().slice(0, 500);
  await reference.set({ approvalNote: note || FieldValue.delete(), updatedAt: Date.now() }, { merge: true });
  const pledge = pledgeFromData(snapshot.id, snapshot.data()!);
  return { ...pledge, approvalNote: note || undefined, updatedAt: Date.now() };
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

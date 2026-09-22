export interface HebrewDateValue {
  year: number;
  month: number;
  day: number;
}

export interface FamilyMember {
  id: string;
  name: string;
  hebrewDob: HebrewDateValue;
}

export interface Yahrzeit {
  id: string;
  name: string;
  hebrewDate: HebrewDateValue;
}

export interface DonationUser {
  id: string;
  name: string;
  phone: string;
  role: "admin" | "user";
  hebrewDob?: HebrewDateValue;
  familyMembers: FamilyMember[];
  yahrzeits: Yahrzeit[];
  createdAt: number;
  updatedAt: number;
}

export type PledgeStatus = "open" | "pending" | "paid";
export type PaymentMethod = "paybox" | "bank" | "cash";

export interface Pledge {
  id: string;
  userId: string;
  type: string;
  amount: number;
  date: string;
  status: PledgeStatus;
  paymentMethod?: PaymentMethod;
  receiptImage?: string;
  paidAt?: string;
  approvedAt?: string;
  receiptNumber?: string;
  paymentBatchId?: string;
  receiptPledgeIds?: string[];
  approvalNote?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DonationDashboardData {
  users: DonationUser[];
  pledges: Pledge[];
}

// The component names are kept identical to the supplied frontend demo so its
// visual components can be used without changing their design or flow.
export type User = DonationUser;

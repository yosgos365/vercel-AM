import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AdminDashboard } from "./components/AdminDashboard";
import { Login } from "./components/Login";
import { Registration } from "./components/Registration";
import { UserDashboard } from "./components/UserDashboard";
import { DonationsSeatingView } from "./DonationsSeatingView";
import type { DonationDashboardData, DonationUser, Pledge } from "./types";

const ADMIN_TOKEN_KEY = "ahavat-menachem-donations-admin-token";
const ADMIN_ROLE_KEY = "ahavat-menachem-donations-admin-role";
const USER_TOKEN_KEY = "ahavat-menachem-donations-user-token";
type AdminRole = "admin" | "developer";
type SeatingState = Record<string, { status: "available" | "pending" | "taken"; owner?: string }>;

const safeToken = () => {
  try { return sessionStorage.getItem(ADMIN_TOKEN_KEY) || ""; }
  catch { return ""; }
};

const saveToken = (token: string) => {
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch { /* Private browsing can disable session storage. */ }
};

const savedAdminRole = (): AdminRole => {
  try { return sessionStorage.getItem(ADMIN_ROLE_KEY) === "developer" ? "developer" : "admin"; }
  catch { return "admin"; }
};

const saveAdminRole = (role: AdminRole | null) => {
  try {
    if (role) sessionStorage.setItem(ADMIN_ROLE_KEY, role);
    else sessionStorage.removeItem(ADMIN_ROLE_KEY);
  } catch { /* Private browsing can disable session storage. */ }
};

const savedUserToken = () => {
  try { return sessionStorage.getItem(USER_TOKEN_KEY) || ""; }
  catch { return ""; }
};

const saveUserToken = (token: string) => {
  try {
    if (token) sessionStorage.setItem(USER_TOKEN_KEY, token);
    else sessionStorage.removeItem(USER_TOKEN_KEY);
  } catch { /* Private browsing can disable session storage. */ }
};

const fileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("קריאת האסמכתא נכשלה"));
  reader.onload = () => resolve(String(reader.result));
  reader.readAsDataURL(file);
});

export function DonationApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token, setToken] = useState(safeToken);
  const [adminRole, setAdminRole] = useState<AdminRole>(savedAdminRole);
  const [data, setData] = useState<DonationDashboardData>({ users: [], pledges: [] });
  const [seating, setSeating] = useState<SeatingState>({});
  const [userToken, setUserToken] = useState(savedUserToken);
  const [userData, setUserData] = useState<{ user: DonationUser; pledges: Pledge[] } | null>(null);
  const [registeringPhone, setRegisteringPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const showNotice = useCallback((message: string, tone: "success" | "error" = "success") => {
    setNotice({ message, tone });
    window.setTimeout(() => setNotice(current => current?.message === message ? null : current), 4500);
  }, []);

  const request = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
    return body;
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setData(await request("/api/donations/admin/dashboard"));
      setError("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "טעינת הנתונים נכשלה";
      setError(message);
      if (message.includes("תוקף ההתחברות")) {
        setToken("");
        saveToken("");
        saveAdminRole(null);
      }
    } finally {
      setLoading(false);
    }
  }, [request, token]);

  useEffect(() => { void refresh(); }, [refresh]);

  const refreshSeating = useCallback(async () => {
    if (!token || !adminRole) return;
    try {
      const dashboard = await request("/api/admin/dashboard");
      setSeating(dashboard.seats || {});
    } catch (cause) {
      console.error("טעינת השיבוץ נכשלה", cause);
    }
  }, [adminRole, request, token]);

  useEffect(() => { void refreshSeating(); }, [refreshSeating]);

  const userRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
        ...(options.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
    return body;
  }, [userToken]);

  const refreshUser = useCallback(async () => {
    if (!userToken) return;
    setLoading(true);
    try {
      setUserData(await userRequest("/api/donations/me"));
      setError("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "טעינת הנתונים נכשלה";
      setError(message);
      setUserData(null);
      if (message.includes("תוקף ההתחברות")) {
        setUserToken("");
        saveUserToken("");
      }
    } finally {
      setLoading(false);
    }
  }, [userRequest, userToken]);

  useEffect(() => { void refreshUser(); }, [refreshUser]);

  const adminLogin = async (password: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/donations/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.token) throw new Error(body.error || "סיסמת מנהל שגויה.");
      const role: AdminRole = body.role === "developer" ? "developer" : "admin";
      saveToken(body.token);
      saveAdminRole(role);
      setToken(body.token);
      setAdminRole(role);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ההתחברות נכשלה");
    } finally {
      setLoading(false);
    }
  };

  const mutate = async (url: string, method: "POST" | "PUT" | "DELETE", body?: unknown, successMessage?: string) => {
    try {
      await request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      await refresh();
      if (successMessage) showNotice(successMessage);
      return true;
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : "הפעולה נכשלה", "error");
      return false;
    }
  };

  const userLogin = async (phone: string) => {
    const normalizedPhone = phone.replace(/\D/g, "");
    if (!/^(?:05\d{8}|050)$/.test(normalizedPhone)) {
      setError("יש להזין מספר טלפון נייד תקין.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/donations/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "ההתחברות נכשלה");
      if (body.registrationRequired) {
        setRegisteringPhone(normalizedPhone);
        setError("");
        return;
      }
      saveUserToken(body.token);
      setUserToken(body.token);
      setUserData({ user: body.user, pledges: [] });
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ההתחברות נכשלה");
    } finally {
      setLoading(false);
    }
  };

  const registerUser = async (input: { name: string; phone: string; hebrewDob: { year: number; month: number; day: number } }) => {
    setLoading(true);
    try {
      const response = await fetch("/api/donations/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "ההרשמה נכשלה");
      saveUserToken(body.token);
      setUserToken(body.token);
      setUserData({ user: body.user, pledges: [] });
      setRegisteringPhone(null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ההרשמה נכשלה");
    } finally {
      setLoading(false);
    }
  };

  const updateCurrentUser = async (user: DonationUser) => {
    try {
      await userRequest("/api/donations/me", { method: "PUT", body: JSON.stringify(user) });
      await refreshUser();
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : "עדכון הפרטים נכשל", "error");
    }
  };

  const submitCurrentUserPayment = async (pledgeIds: string[], method: "paybox" | "bank", file: File | null) => {
    if (!file) {
      showNotice("יש לצרף אסמכתא לתשלום", "error");
      return false;
    }
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("גודל תמונת האסמכתא המרבי הוא 5MB");
      await userRequest("/api/donations/me/payment", {
        method: "POST",
        body: JSON.stringify({ pledgeIds, paymentMethod: method, receiptImage: await fileAsDataUrl(file) }),
      });
      await refreshUser();
      showNotice("הדיווח והתמונה נשמרו ונשלחו לאישור הגבאי.");
      return true;
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : "דיווח התשלום נכשל", "error");
      return false;
    }
  };

  const viewReceiptImage = async (receiptImage?: string) => {
    if (!receiptImage) return showNotice("לא צורפה אסמכתא לתשלום זה.", "error");
    try {
      // Navigation, rather than fetch()+Blob, lets the browser follow the
      // short-lived Firebase signed URL without being blocked by CORS.
      const target = `${receiptImage}?token=${encodeURIComponent(token)}`;
      const link = document.createElement("a");
      link.href = target;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (cause) {
      showNotice(cause instanceof Error ? cause.message : "פתיחת האסמכתא נכשלה", "error");
    }
  };

  if (registeringPhone) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4" dir="rtl">
        <Registration
          initialPhone={registeringPhone}
          onRegister={(input) => void registerUser(input)}
          onCancel={() => { setRegisteringPhone(null); setError(""); }}
        />
      </div>
    );
  }

  const noticeBanner = notice && <div role="status" className={`fixed inset-x-4 bottom-5 z-[200] mx-auto max-w-md rounded-xl px-4 py-3 text-center text-sm font-bold shadow-xl ${notice.tone === "success" ? "bg-emerald-700 text-white" : "bg-rose-700 text-white"}`}>{notice.message}</div>;

  if (userToken && userData && location.pathname.endsWith("/seating")) {
    return <DonationsSeatingView onBack={() => navigate("/donations", { replace: true })} />;
  }

  if (userToken && userData) {
    return (
      <div dir="rtl">
        <UserDashboard
          user={userData.user}
          pledges={userData.pledges}
          onLogout={() => { saveUserToken(""); setUserToken(""); setUserData(null); }}
          onSubmitPayment={submitCurrentUserPayment}
          onUpdateUser={(user) => void updateCurrentUser(user)}
        />
        {noticeBanner}
      </div>
    );
  }

  if (!token) {
    return (
      <Login
        error={error || (loading ? "מתחבר..." : undefined)}
        onAdminLogin={(password) => void adminLogin(password)}
        onLogin={(phone) => void userLogin(phone)}
      />
    );
  }

  const admin: DonationUser = {
    id: "admin-session",
    name: "גבאי ראשי",
    phone: "",
    role: "admin",
    familyMembers: [],
    yahrzeits: [],
    createdAt: 0,
    updatedAt: 0,
  };

  return (
    <div dir="rtl">
      {loading && <div className="fixed inset-x-0 top-0 z-[100] h-1 bg-blue-600 animate-pulse" />}
      <AdminDashboard
        user={admin}
        users={data.users}
        pledges={data.pledges}
        onLogout={() => {
          void fetch("/api/admin/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
          saveToken("");
          saveAdminRole(null);
          setToken("");
          setAdminRole("admin");
        }}
        onApprovePledge={(pledgeId, approvalNote) => mutate(`/api/donations/admin/pledges/${pledgeId}/approve`, "POST", { approvalNote }, "התשלום אושר ונשמר בהצלחה.")}
        onSavePledgeNote={(pledgeId, approvalNote) => mutate(`/api/donations/admin/pledges/${pledgeId}/note`, "PUT", { approvalNote }, "הערת הגבאי נשמרה.")}
        onViewReceipt={viewReceiptImage}
        onAddPledge={(pledge: Partial<Pledge>, name, phone) => mutate("/api/donations/admin/pledges", "POST", {
          name,
          phone,
          type: pledge.type,
          amount: pledge.amount,
          date: pledge.date,
          approvalNote: pledge.approvalNote,
        }, "ההתחייבות נוספה בהצלחה.")}
        onUpdateUser={(userId, name, phone) => mutate(`/api/donations/admin/users/${userId}`, "PUT", { name, phone }, "פרטי המתפלל נשמרו.")}
        onAddUser={(name, phone) => mutate("/api/donations/admin/users", "POST", { name, phone }, "המתפלל נוסף בהצלחה.")}
        onDeleteUser={(userId) => mutate(`/api/donations/admin/users/${userId}`, "DELETE", undefined, "המתפלל נמחק.")}
        isDeveloper={adminRole === "developer"}
        onChangeAdminPassword={async (newPassword) => {
          await request("/api/admin/change-password", { method: "POST", body: JSON.stringify({ newPassword }) });
        }}
        onDeletePledge={(pledgeId) => mutate(`/api/donations/developer/pledges/${pledgeId}`, "DELETE", undefined, "ההתחייבות נמחקה.")}
        seating={seating}
        onUpdateSeat={adminRole ? async (seatId, owner) => {
          await request(`/api/admin/seat/${seatId}`, {
            method: "POST",
            body: JSON.stringify({ status: owner ? "taken" : "available", owner }),
          });
          await refreshSeating();
        } : undefined}
      />
      {noticeBanner}
    </div>
  );
}

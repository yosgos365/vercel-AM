import { useCallback, useEffect, useState } from "react";
import { AdminDashboard } from "./components/AdminDashboard";
import { Login } from "./components/Login";
import type { DonationDashboardData, DonationUser, Pledge } from "./types";

const ADMIN_TOKEN_KEY = "ahavat-menachem-donations-admin-token";

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

export function DonationApp() {
  const [token, setToken] = useState(safeToken);
  const [data, setData] = useState<DonationDashboardData>({ users: [], pledges: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      }
    } finally {
      setLoading(false);
    }
  }, [request, token]);

  useEffect(() => { void refresh(); }, [refresh]);

  const adminLogin = async (password: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.token) throw new Error(body.error || "סיסמת מנהל שגויה.");
      saveToken(body.token);
      setToken(body.token);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ההתחברות נכשלה");
    } finally {
      setLoading(false);
    }
  };

  const mutate = async (url: string, method: "POST" | "PUT" | "DELETE", body?: unknown) => {
    try {
      await request(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      await refresh();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "הפעולה נכשלה");
    }
  };

  if (!token) {
    return (
      <Login
        error={error || (loading ? "מתחבר..." : undefined)}
        onAdminLogin={(password) => void adminLogin(password)}
        onLogin={() => setError("התחברות טלפונית מאובטחת תופעל לאחר הגדרת אימות SMS ב־Firebase.")}
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
    <>
      {loading && <div className="fixed inset-x-0 top-0 z-[100] h-1 bg-blue-600 animate-pulse" />}
      <AdminDashboard
        user={admin}
        users={data.users}
        pledges={data.pledges}
        onLogout={() => {
          void fetch("/api/admin/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
          saveToken("");
          setToken("");
        }}
        onApprovePledge={(pledgeId) => void mutate(`/api/donations/admin/pledges/${pledgeId}/approve`, "POST")}
        onAddPledge={(pledge: Partial<Pledge>, name, phone) => void mutate("/api/donations/admin/pledges", "POST", {
          name,
          phone,
          type: pledge.type,
          amount: pledge.amount,
          date: pledge.date,
        })}
        onUpdateUser={(userId, name, phone) => void mutate(`/api/donations/admin/users/${userId}`, "PUT", { name, phone })}
        onAddUser={(name, phone) => void mutate("/api/donations/admin/users", "POST", { name, phone })}
        onDeleteUser={(userId) => void mutate(`/api/donations/admin/users/${userId}`, "DELETE")}
      />
    </>
  );
}

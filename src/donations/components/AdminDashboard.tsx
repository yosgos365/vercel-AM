import React, { useRef, useState } from 'react';
import { User, Pledge } from '../types';
import { Home } from '../../pages/Home';
import { LogOut, Users, FileCheck, PlusCircle, CheckCircle2, Search, Image as ImageIcon, Contact, Printer, Download, Trash2, KeyRound, Wrench, Map as MapIcon, MessageSquarePlus } from 'lucide-react';
import html2canvas from 'html2canvas';

interface AdminDashboardProps {
  user: User;
  users: User[];
  pledges: Pledge[];
  onLogout: () => void;
  onApprovePledge: (id: string, approvalNote: string) => Promise<boolean>;
  onSavePledgeNote: (id: string, approvalNote: string) => Promise<boolean>;
  onViewReceipt: (receiptImage?: string) => void;
  onAddPledge: (pledgeData: Partial<Pledge>, userName: string, phone: string) => Promise<boolean>;
  onUpdateUser: (id: string, name: string, phone: string) => Promise<boolean>;
  onAddUser: (name: string, phone: string) => Promise<boolean>;
  onDeleteUser: (id: string) => Promise<boolean>;
  isDeveloper?: boolean;
  onChangeAdminPassword?: (newPassword: string) => Promise<void> | void;
  onDeletePledge?: (id: string) => Promise<boolean>;
  seating?: Record<string, { status: "available" | "pending" | "taken"; owner?: string }>;
  onUpdateSeat?: (seatId: string, owner: string) => Promise<void> | void;
}

export function AdminDashboard({ user, users, pledges, onLogout, onApprovePledge, onSavePledgeNote, onViewReceipt, onAddPledge, onUpdateUser, onAddUser, onDeleteUser, isDeveloper = false, onChangeAdminPassword, onDeletePledge, seating = {}, onUpdateSeat }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'add' | 'all' | 'users' | 'seating'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [receiptPledge, setReceiptPledge] = useState<Pledge | null>(null);
  const [generatedReceipt, setGeneratedReceipt] = useState<string | null>(null);
  const [userModal, setUserModal] = useState<{ isOpen: boolean; mode: 'add' | 'edit'; id?: string; name: string; phone: string }>({ isOpen: false, mode: 'add', name: '', phone: '' });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' });
  const [pledgeDeleteModal, setPledgeDeleteModal] = useState<{ isOpen: boolean; id: string; name: string; type: string }>({ isOpen: false, id: '', name: '', type: '' });
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [approvalModal, setApprovalModal] = useState<{ isOpen: boolean; id: string; note: string }>({ isOpen: false, id: '', note: '' });
  const [noteModal, setNoteModal] = useState<{ isOpen: boolean; id: string; note: string }>({ isOpen: false, id: '', note: '' });
  const [selectedSeat, setSelectedSeat] = useState<{ id: string; owner: string; status: "available" | "pending" | "taken" } | null>(null);
  const [savingSeat, setSavingSeat] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleDownloadReceipt = async () => {
    const receiptElement = document.getElementById('receipt-content-to-download');
    if (!receiptElement) return;
    
    try {
      const canvas = await html2canvas(receiptElement, {
        scale: 2,
        backgroundColor: '#ffffff'
      });
      
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not generate receipt image');
      const image = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = image;
      link.download = `אישור תשלום-${receiptPledge?.receiptNumber || 'תרומה'}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setGeneratedReceipt(image);
    } catch (err) {
      console.error('Failed to download receipt', err);
      alert('אירעה שגיאה בהורדת האישור תשלום.');
    }
  };

  const pendingPledges = pledges.filter(p => p.status === 'pending');
  const receiptPledges = receiptPledge
    ? (() => { const related = pledges.filter((pledge) => pledge.receiptNumber === receiptPledge.receiptNumber || receiptPledge.receiptPledgeIds?.includes(pledge.id)); return related.length ? related : [receiptPledge]; })()
    : [];
  const receiptTotal = receiptPledges.reduce((sum, pledge) => sum + pledge.amount, 0);

  const cancelLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const beginLongPress = (pledge: Pledge) => {
    if (!isDeveloper || !onDeletePledge) return;
    cancelLongPress();
    const name = getUserDetails(pledge.userId)?.name || 'המתפלל';
    longPressTimer.current = window.setTimeout(() => {
      setPledgeDeleteModal({ isOpen: true, id: pledge.id, name, type: pledge.type });
      longPressTimer.current = null;
    }, 650);
  };

  const saveAdminPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onChangeAdminPassword) return;
    if (newAdminPassword.length < 4) {
      setPasswordError('הסיסמה צריכה לכלול לפחות 4 תווים.');
      return;
    }
    try {
      await onChangeAdminPassword(newAdminPassword);
      setPasswordModalOpen(false);
      setNewAdminPassword('');
      setPasswordError('');
      alert('סיסמת המנהל עודכנה בהצלחה.');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'עדכון הסיסמה נכשל.');
    }
  };
  
  const [newPledgeName, setNewPledgeName] = useState('');
  const [newPledgePhone, setNewPledgePhone] = useState('');
  const [newPledgeType, setNewPledgeType] = useState('עלייה לתורה');
  const [newPledgeAmount, setNewPledgeAmount] = useState('');
  const [newPledgeDate, setNewPledgeDate] = useState(new Date().toISOString().split('T')[0]);
  const [newPledgeNote, setNewPledgeNote] = useState('');

  const matchingUser = users.find(u => u.name === newPledgeName);
  const isExistingUser = !!matchingUser;
  
  const openAddUserModal = () => {
    setUserModal({ isOpen: true, mode: 'add', name: '', phone: '' });
  };
  
  const openEditUserModal = (id: string, name: string, phone: string) => {
    setUserModal({ isOpen: true, mode: 'edit', id, name, phone });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userModal.name || !userModal.phone) return;
    
    if (userModal.mode === 'add') {
      if (!await onAddUser(userModal.name, userModal.phone)) return;
    } else if (userModal.mode === 'edit' && userModal.id) {
      if (!await onUpdateUser(userModal.id, userModal.name, userModal.phone)) return;
    }
    
    setUserModal({ isOpen: false, mode: 'add', name: '', phone: '' });
  };
  
  const handleExportCSV = () => {
    const headers = ['שם מתפלל', 'טלפון', 'סוג התחייבות/תרומה', 'סכום', 'תאריך', 'סטטוס', 'אמצעי תשלום', 'הערת גבאי'];
    
    const rows = filteredPledges.map(p => {
      const u = getUserDetails(p.userId);
      const statusStr = p.status === 'open' ? 'לא שולם' : p.status === 'pending' ? 'ממתין לאישור' : 'שולם';
      const paymentMethodStr = p.paymentMethod === 'cash' ? 'מזומן' : p.paymentMethod === 'bank' ? 'העברה בנקאית' : p.paymentMethod === 'paybox' ? 'פייבוקס / אשראי' : '';
      
      return [
        u?.name || 'לא ידוע',
        u?.phone || '',
        p.type,
        p.amount.toString(),
        new Date(p.date).toLocaleDateString('he-IL'),
        statusStr,
        paymentMethodStr,
        p.approvalNote || ''
      ].map(field => `"${field}"`).join(',');
    });
    
    const csvContent = '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `דוח_הכנסות_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportUsersCSV = () => {
    const headers = ['שם מתפלל', 'טלפון', 'תאריך הצטרפות'];
    const rows = filteredUsers.map((user) => [user.name, user.phone, new Date(user.createdAt).toLocaleDateString('he-IL')].map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob(['\uFEFF' + [headers.map((header) => `"${header}"`).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `רשימת_מתפללים_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneToUse = isExistingUser ? matchingUser.phone : newPledgePhone;

    if (!newPledgeName || (!isExistingUser && !newPledgePhone) || !newPledgeAmount) {
      return;
      return;
    }

    if (!await onAddPledge({
      type: newPledgeType,
      amount: Number(newPledgeAmount),
      date: newPledgeDate,
      approvalNote: newPledgeNote.trim(),
      status: 'open'
    }, newPledgeName, phoneToUse)) return;

    setNewPledgeName('');
    setNewPledgePhone('');
    setNewPledgeAmount('');
    setNewPledgeNote('');
    setActiveTab('all');
  };

  const getUserDetails = (userId: string) => users.find(u => u.id === userId);

  const filteredPledges = pledges.filter(p => {
    if (activeTab === 'pending' && p.status !== 'pending') return false;
    
    if (searchTerm) {
      const u = getUserDetails(p.userId);
      return u?.name.includes(searchTerm) || u?.phone.includes(searchTerm) || p.type.includes(searchTerm);
    }
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredUsers = users.filter((item) => item.role !== 'admin' && (!searchTerm || item.name.includes(searchTerm) || item.phone.includes(searchTerm)));

  return (
    <div className="min-h-screen bg-stone-100 pb-12">
      <header className={`bg-slate-900 text-white shadow-sm ${activeTab === 'seating' ? '' : 'sticky top-0 z-10'}`}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-slate-800 p-1 rounded-lg">
              <img src="/logo-no-text.jpeg" alt="אחוות מנחם" className="w-10 h-auto object-contain mix-blend-multiply" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">{isDeveloper ? 'ממשק מפתח' : 'ממשק ניהול גבאים'}</h1>
              <p className="text-slate-300 text-sm">{isDeveloper ? 'גישה לפעולות מפתח' : `שלום, ${user.name}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onChangeAdminPassword && (
              <button onClick={() => { setPasswordModalOpen(true); setPasswordError(''); }} className="text-slate-300 hover:text-white flex items-center gap-1 p-2 rounded-lg hover:bg-slate-800 transition-colors" title="שינוי סיסמת מנהל">
                <KeyRound className="w-5 h-5" />
                <span className="hidden sm:inline text-sm font-medium">סיסמה</span>
              </button>
            )}
            {isDeveloper && <Wrench className="w-5 h-5 text-amber-300" aria-label="מצב מפתח" />}
            <button onClick={onLogout} className="text-slate-300 hover:text-white flex items-center gap-1 p-2 rounded-lg hover:bg-slate-800 transition-colors">
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-medium">התנתק</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8">
        <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 rounded-md whitespace-nowrap ${
              activeTab === 'pending' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            ממתינים לאישור
            {pendingPledges.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded-full text-xs">
                {pendingPledges.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 rounded-md whitespace-nowrap ${
              activeTab === 'all' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <Users className="w-4 h-4" />
            כל ההתחייבויות
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 rounded-md whitespace-nowrap ${
              activeTab === 'add' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            הוספת התחייבות
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 rounded-md whitespace-nowrap ${
              activeTab === 'users' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <Contact className="w-4 h-4" />
            מתפללים
          </button>
          {onUpdateSeat && (
            <button
              onClick={() => setActiveTab('seating')}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 rounded-md whitespace-nowrap ${
                activeTab === 'seating' ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              עריכת שיבוץ
            </button>
          )}
        </div>

        {(activeTab === 'all' || activeTab === 'pending' || activeTab === 'users') && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex gap-3 items-center justify-between">
            <div className="flex gap-3 items-center flex-1 max-w-lg">
              <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="חיפוש לפי שם, טלפון או סוג..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-slate-700"
              />
            </div>
            
            {activeTab === 'users' ? (
              <button onClick={handleExportUsersCSV} className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold rounded-lg transition-colors flex items-center gap-2 text-sm whitespace-nowrap"><Download className="w-4 h-4" />ייצוא מתפללים לאקסל</button>
            ) : (
              <button 
                onClick={handleExportCSV}
                className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold rounded-lg transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                ייצא לאקסל
              </button>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          
          {activeTab === 'seating' ? (
            <div className="p-4 sm:p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800">עריכת שיבוץ המקומות</h2>
                <p className="mt-1 text-sm text-slate-500">השמות כאן מוצגים ללקוחות במפת השיבוץ. השארת השם ריק תפנה את המושב.</p>
              </div>
              <Home initialViewMode lockViewMode editableSeats={seating} onSeatClick={(seatId) => { const current = seating[seatId]; setSelectedSeat({ id: seatId, owner: current?.owner || '', status: current?.status || 'available' }); }} />
              {selectedSeat && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={() => setSelectedSeat(null)}>
                <form onMouseDown={(event) => event.stopPropagation()} onSubmit={async (event) => { event.preventDefault(); setSavingSeat(selectedSeat.id); try { await onUpdateSeat(selectedSeat.id, selectedSeat.owner.trim()); setSelectedSeat(null); } finally { setSavingSeat(null); } }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                  <div className="mb-5 flex items-start justify-between gap-4"><div><h3 className="text-xl font-bold text-slate-800">עריכת מושב <span dir="ltr">{selectedSeat.id}</span></h3><p className="mt-1 text-sm text-slate-500">השם שיישמר יוצג גם במפת הלקוחות.</p></div><button type="button" onClick={() => setSelectedSeat(null)} className="text-slate-400 hover:text-slate-700">סגירה</button></div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">שם בשיבוץ</label>
                  <input autoFocus value={selectedSeat.owner} onChange={(event) => setSelectedSeat({ ...selectedSeat, owner: event.target.value })} placeholder="השאירו ריק כדי לפנות את המושב" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                  <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setSelectedSeat(null)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">ביטול</button><button disabled={savingSeat === selectedSeat.id} type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{savingSeat === selectedSeat.id ? 'שומר...' : 'שמור'}</button></div>
                </form>
              </div>}
            </div>
          ) : activeTab === 'add' ? (
            <div className="p-8 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-800 mb-6 border-b border-slate-100 pb-4">רישום התחייבות / אורח חדש</h2>
              <form onSubmit={handleAddSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">שם מתפלל / אורח</label>
                    <input 
                      required 
                      type="text" 
                      list="users-list"
                      value={newPledgeName} 
                      onChange={e=>setNewPledgeName(e.target.value)} 
                      className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600" 
                      placeholder="ישראל ישראלי" 
                    />
                    <datalist id="users-list">
                      {users.filter(u => u.role !== 'admin').map(u => (
                        <option key={u.id} value={u.name} />
                      ))}
                    </datalist>
                  </div>
                  {!isExistingUser && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">מספר טלפון (לזיהוי וכניסה למשתמש חדש)</label>
                      <input 
                        required 
                        type="tel" 
                        value={newPledgePhone} 
                        onChange={e=>setNewPledgePhone(e.target.value)} 
                        className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600" 
                        placeholder="05X-XXXXXXX" 
                      />
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">סוג התחייבות</label>
                  <input 
                    required 
                    type="text" 
                    value={newPledgeType} 
                    onChange={e=>setNewPledgeType(e.target.value)} 
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600" 
                    placeholder="עליה לתורה / מי שברך / תרומה כללית" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">סכום (₪)</label>
                  <input 
                    required 
                    type="number" 
                    min="1"
                    value={newPledgeAmount} 
                    onChange={e=>setNewPledgeAmount(e.target.value)} 
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 font-mono text-lg" 
                    placeholder="100" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">הערת גבאי <span className="text-slate-400 font-normal">(לא חובה)</span></label>
                  <input type="text" value={newPledgeNote} onChange={event => setNewPledgeNote(event.target.value)} maxLength={500} className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600" />
                </div>
                
                <button 
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg shadow hover:bg-indigo-700 transition-colors"
                >
                  רשום התחייבות
                </button>
              </form>
            </div>
          ) : activeTab === 'users' ? (
            <div className="overflow-x-auto">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">רשימת מתפללים</h3>
                <button onClick={openAddUserModal} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2">
                  <PlusCircle className="w-4 h-4" />
                  הוסף מתפלל חדש
                </button>
              </div>
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  לא נמצאו מתפללים.
                </div>
              ) : (
                <table className="w-full text-right">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm font-medium">
                    <tr>
                      <th className="p-4">שם מתפלל</th>
                      <th className="p-4">מספר טלפון</th>
                      <th className="p-4">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold text-slate-800">{u.name}</td>
                        <td className="p-4 font-mono text-slate-600" dir="ltr">{u.phone}</td>
                        <td className="p-4">
                          <button
                            onClick={() => openEditUserModal(u.id, u.name, u.phone)}
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-colors"
                          >
                            ערוך פרטים
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              {filteredPledges.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  לא נמצאו תוצאות.
                </div>
              ) : (
                <table className="w-full text-right">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm font-medium">
                    <tr>
                      <th className="p-4">מתפלל</th>
                      <th className="p-4">סוג</th>
                      <th className="p-4">סכום</th>
                      <th className="p-4">תאריך</th>
                      <th className="p-4">סטטוס</th>
                      <th className="p-4">דרך תשלום</th>
                      <th className="p-4">הערת גבאי</th>
                      <th className="p-4">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPledges.map(pledge => {
                      const pledgeUser = getUserDetails(pledge.userId);
                      return (
                        <tr key={pledge.id} className={`hover:bg-slate-50/50 transition-colors ${isDeveloper ? 'select-none' : ''}`}
                          onPointerDown={() => beginLongPress(pledge)}
                          onPointerUp={cancelLongPress}
                          onPointerLeave={cancelLongPress}
                          onPointerCancel={cancelLongPress}
                        >
                          <td className="p-4">
                            <div className="font-bold text-slate-800">{pledgeUser?.name || 'לא ידוע'}</div>
                            <div className="text-xs text-slate-500 font-mono" dir="ltr">{pledgeUser?.phone}</div>
                          </td>
                          <td className="p-4 text-sm font-medium text-slate-800">{pledge.type}</td>
                          <td className="p-4 font-bold text-slate-900">₪{pledge.amount}</td>
                          <td className="p-4 text-sm text-slate-600">{new Date(pledge.date).toLocaleDateString('he-IL')}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              pledge.status === 'open' ? 'bg-slate-100 text-slate-700' :
                              pledge.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {pledge.status === 'open' ? 'לא שולם' : 
                               pledge.status === 'pending' ? 'ממתין לאישור' : 'שולם'}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-slate-600">{pledge.paymentMethod === 'paybox' ? 'PayBox' : pledge.paymentMethod === 'bank' ? 'העברה בנקאית' : pledge.paymentMethod === 'cash' ? 'מזומן' : '—'}</td>
                          <td className="p-4 text-sm text-slate-600">
                            <button
                              type="button"
                              onClick={() => setNoteModal({ isOpen: true, id: pledge.id, note: pledge.approvalNote || '' })}
                              className={pledge.approvalNote ? 'max-w-48 truncate rounded-md px-2 py-1 text-right text-indigo-700 hover:bg-indigo-50 hover:underline' : 'rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-700'}
                              title={pledge.approvalNote ? 'עריכת הערת גבאי' : 'הוספת הערת גבאי'}
                            >
                              {pledge.approvalNote ? pledge.approvalNote : <MessageSquarePlus className="h-4 w-4" aria-label="הוספת הערת גבאי" />}
                            </button>
                          </td>
                          <td className="p-4">
                            {pledge.status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  className="flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                                  onClick={() => onViewReceipt(pledge.receiptImage)}
                                >
                                  <ImageIcon className="w-4 h-4" />
                                  צפה באסמכתא
                                </button>
                                <button
                                  onClick={() => setApprovalModal({ isOpen: true, id: pledge.id, note: pledge.approvalNote || '' })}
                                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  אשר
                                </button>
                              </div>
                            )}
                            {pledge.status === 'paid' && (
                              <button
                                onClick={() => setReceiptPledge(pledge)}
                                className="flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-blue-200"
                              >
                                <Printer className="w-4 h-4" />
                                הופק אישור תשלום {pledge.receiptNumber}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>

      {approvalModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={(event) => { event.preventDefault(); onApprovePledge(approvalModal.id, approvalModal.note.trim()); setApprovalModal({ isOpen: false, id: '', note: '' }); }} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">אישור תשלום</h3>
            <p className="mt-1 text-sm text-slate-600">לאחר האישור יופק מספר אישור תשלום. הערות גבאי מנוהלות בנפרד בכל שורה.</p>
            <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setApprovalModal({ isOpen: false, id: '', note: '' })} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">ביטול</button><button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">אשר תשלום</button></div>
          </form>
        </div>
      )}

      {noteModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={async (event) => { event.preventDefault(); if (await onSavePledgeNote(noteModal.id, noteModal.note)) setNoteModal({ isOpen: false, id: '', note: '' }); }} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">הערת גבאי</h3>
            <p className="mt-1 text-sm text-slate-600">ההערה פנימית ונשמרת לצד ההתחייבות בכל סטטוס.</p>
            <textarea autoFocus value={noteModal.note} onChange={(event) => setNoteModal({ ...noteModal, note: event.target.value })} maxLength={500} rows={4} placeholder="הוסיפו הערה" className="mt-4 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600" />
            <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setNoteModal({ isOpen: false, id: '', note: '' })} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">ביטול</button><button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">שמור הערה</button></div>
          </form>
        </div>
      )}
      
      
      {/* Delete Confirm Modal */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[60] overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm my-8 overflow-hidden text-center">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">מחיקת מתפלל</h3>
              <p className="text-slate-600 text-sm mb-6">
                האם אתה בטוח שברצונך למחוק את <strong>{deleteConfirmModal.name}</strong>? פעולה זו תסיר את המשתמש מהמערכת.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDeleteConfirmModal({ isOpen: false, id: '', name: '' })}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors w-full"
                >
                  ביטול
                </button>
                <button
                  onClick={() => {
                    onDeleteUser(deleteConfirmModal.id);
                    setDeleteConfirmModal({ isOpen: false, id: '', name: '' });
                  }}
                  className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg shadow hover:bg-red-700 transition-colors w-full"
                >
                  מחק
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pledgeDeleteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm my-8 overflow-hidden text-center">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">מחיקת התחייבות</h3>
              <p className="text-slate-600 text-sm mb-6">
                למחוק את ההתחייבות של <strong>{pledgeDeleteModal.name}</strong> עבור <strong>{pledgeDeleteModal.type}</strong>? פעולה זו אינה ניתנת לביטול.
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setPledgeDeleteModal({ isOpen: false, id: '', name: '', type: '' })} className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors w-full">ביטול</button>
                <button
                  onClick={async () => {
                    await onDeletePledge?.(pledgeDeleteModal.id);
                    setPledgeDeleteModal({ isOpen: false, id: '', name: '', type: '' });
                  }}
                  className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg shadow hover:bg-red-700 transition-colors w-full"
                >
                  מחק התחייבות
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {passwordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm my-8 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">שינוי סיסמת מנהל</h3>
              <button onClick={() => setPasswordModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors font-bold">&times;</button>
            </div>
            <form onSubmit={saveAdminPassword} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">סיסמה חדשה</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newAdminPassword}
                  onChange={(event) => { setNewAdminPassword(event.target.value); setPasswordError(''); }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  autoComplete="new-password"
                />
                {passwordError && <p className="mt-2 text-sm text-red-600">{passwordError}</p>}
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setPasswordModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors">ביטול</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow hover:bg-indigo-700 transition-colors">שמור סיסמה</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {userModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md my-8 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">
                {userModal.mode === 'add' ? 'הוספת מתפלל חדש' : 'עריכת מתפלל'}
              </h3>
              <button
                onClick={() => setUserModal({ isOpen: false, mode: 'add', name: '', phone: '' })}
                className="text-slate-400 hover:text-slate-600 transition-colors font-bold"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">שם מתפלל</label>
                <input
                  type="text"
                  required
                  value={userModal.name}
                  onChange={(e) => setUserModal({ ...userModal, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="ישראל ישראלי"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">מספר טלפון (כניסה למערכת)</label>
                <input
                  type="tel"
                  required
                  value={userModal.phone}
                  onChange={(e) => setUserModal({ ...userModal, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-right"
                  dir="ltr"
                  placeholder="05X-XXXXXXX"
                />
              </div>
              
              <div className="pt-4 flex items-center justify-between mt-2">
                <div>
                  {userModal.mode === 'edit' && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserModal({ isOpen: false, mode: 'add', name: '', phone: '' });
                        setDeleteConfirmModal({ isOpen: true, id: userModal.id || '', name: userModal.name });
                      }}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      מחק מתפלל
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setUserModal({ isOpen: false, mode: 'add', name: '', phone: '' })}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors"
                  >
                    ביטול
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow hover:bg-indigo-700 transition-colors"
                  >
                    {userModal.mode === 'add' ? 'שמור מתפלל' : 'עדכן פרטים'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptPledge && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md my-8">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl print:hidden">
              <h3 className="font-bold text-slate-800">הדפסת אישור תשלום</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadReceipt}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  הורד
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
                >
                  <Printer className="w-4 h-4" />
                  הדפס
                </button>
                <button
                  onClick={() => { setReceiptPledge(null); setGeneratedReceipt(null); }}
                  className="px-3 py-1.5 text-slate-500 hover:bg-slate-200 text-sm font-bold rounded-lg transition-colors"
                >
                  סגור
                </button>
              </div>
            </div>
            
            {generatedReceipt ? (
              <div className="p-8 bg-white text-center rounded-b-xl">
                <p className="text-emerald-600 font-bold mb-4">האישור תשלום הופק בהצלחה!</p>
                <p className="text-slate-600 text-sm mb-4">האישור מוכן גם להורדה וגם לשמירה ידנית.</p>
                <img src={generatedReceipt} alt="אישור תשלום" className="max-w-full h-auto border border-slate-200 shadow-sm mx-auto mb-4 rounded" />
                <a href={generatedReceipt} download={`אישור תשלום-${receiptPledge?.receiptNumber || 'תרומה'}.png`} className="mb-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">הורד קובץ PNG</a>
                <p className="text-indigo-600 font-bold text-sm bg-indigo-50 p-3 rounded-lg inline-block">
                  👈 מטלפון: לחיצה ארוכה על התמונה ➔ "שמור תמונה"<br/>
                  🖱️ ממחשב: קליק ימני על התמונה ➔ "שמור תמונה בשם..."
                </p>
              </div>
            ) : (
              <div id="receipt-content-to-download" className="p-8 print:p-0 receipt-content bg-white text-slate-900">
                <div className="text-center mb-6 border-b border-slate-200 pb-6">
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">אחוות מנחם</h2>
                  <p className="text-slate-500 text-sm">אישור תשלום על תרומה / התחייבות</p>
                  <div className="mt-4 inline-block bg-slate-100 px-3 py-1 rounded-md text-sm font-mono text-slate-700 font-bold border border-slate-200">
                    מספר אישור תשלום: {receiptPledge.receiptNumber}
                  </div>
                </div>
                
                <div className="space-y-4 mb-8 text-sm">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">תאריך הפקה:</span>
                    <span className="font-bold">{new Date().toLocaleDateString('he-IL')}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">שם התורם:</span>
                    <span className="font-bold text-lg">{getUserDetails(receiptPledge.userId)?.name || 'לא ידוע'}</span>
                  </div>
                  <div className="border-b border-slate-100 pb-2">
                    <span className="text-slate-500">התחייבויות ששולמו:</span>
                    <ul className="mt-2 space-y-1 font-bold">{receiptPledges.map((pledge) => <li key={pledge.id} className="flex justify-between gap-3"><span>{pledge.type}</span><span dir="ltr">₪{pledge.amount}</span></li>)}</ul>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">סכום ששולם:</span>
                    <span className="font-bold text-xl">₪{receiptTotal}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">אמצעי תשלום:</span>
                    <span className="font-bold">{receiptPledge.paymentMethod === 'paybox' ? 'PayBox' : receiptPledge.paymentMethod === 'bank' ? 'העברה בנקאית' : 'מזומן'}</span>
                  </div>
                </div>
                <div className="text-center text-sm text-slate-500 pt-6 border-t border-slate-200 border-dashed">
                  <p className="font-bold mb-1">תודה רבה על תרומתך!</p>
                  <p>אישור התשלום מהווה אישור על התשלום שבוצע.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .receipt-content, .receipt-content * { visibility: visible; }
          .receipt-content { position: absolute; left: 0; top: 0; width: 100%; padding: 40px !important; }
        }
      `}} />
    </div>
  );
}

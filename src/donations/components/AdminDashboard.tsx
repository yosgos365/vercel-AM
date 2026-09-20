import React, { useRef, useState } from 'react';
import { User, Pledge } from '../types';
import { SEATS } from '../../MapData';
import { LogOut, Users, FileCheck, PlusCircle, CheckCircle2, Search, Image as ImageIcon, Contact, Printer, Download, Trash2, KeyRound, Wrench, Map as MapIcon } from 'lucide-react';
import html2canvas from 'html2canvas';

interface AdminDashboardProps {
  user: User;
  users: User[];
  pledges: Pledge[];
  onLogout: () => void;
  onApprovePledge: (id: string) => void;
  onAddPledge: (pledgeData: Partial<Pledge>, userName: string, phone: string) => void;
  onUpdateUser: (id: string, name: string, phone: string) => void;
  onAddUser: (name: string, phone: string) => void;
  onDeleteUser: (id: string) => void;
  isDeveloper?: boolean;
  onChangeAdminPassword?: (newPassword: string) => Promise<void> | void;
  onDeletePledge?: (id: string) => Promise<void> | void;
  seating?: Record<string, { status: "available" | "pending" | "taken"; owner?: string }>;
  onUpdateSeat?: (seatId: string, owner: string) => Promise<void> | void;
}

export function AdminDashboard({ user, users, pledges, onLogout, onApprovePledge, onAddPledge, onUpdateUser, onAddUser, onDeleteUser, isDeveloper = false, onChangeAdminPassword, onDeletePledge, seating = {}, onUpdateSeat }: AdminDashboardProps) {
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
  const [seatEdits, setSeatEdits] = useState<Record<string, string>>({});
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
      
      const image = canvas.toDataURL('image/png');
      
      if (window.self !== window.top) {
        setGeneratedReceipt(image);
      } else {
        const link = document.createElement('a');
        link.href = image;
        link.download = `אישור תשלום-${receiptPledge?.receiptNumber || 'תרומה'}.png`;
        link.click();
      }
    } catch (err) {
      console.error('Failed to download receipt', err);
      alert('אירעה שגיאה בהורדת האישור תשלום.');
    }
  };

  const pendingPledges = pledges.filter(p => p.status === 'pending');

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

  const matchingUser = users.find(u => u.name === newPledgeName);
  const isExistingUser = !!matchingUser;
  
  const openAddUserModal = () => {
    setUserModal({ isOpen: true, mode: 'add', name: '', phone: '' });
  };
  
  const openEditUserModal = (id: string, name: string, phone: string) => {
    setUserModal({ isOpen: true, mode: 'edit', id, name, phone });
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userModal.name || !userModal.phone) return;
    
    if (userModal.mode === 'add') {
      onAddUser(userModal.name, userModal.phone);
    } else if (userModal.mode === 'edit' && userModal.id) {
      onUpdateUser(userModal.id, userModal.name, userModal.phone);
    }
    
    setUserModal({ isOpen: false, mode: 'add', name: '', phone: '' });
  };
  
  const handleExportCSV = () => {
    const headers = ['שם מתפלל', 'טלפון', 'סוג התחייבות/תרומה', 'סכום', 'תאריך', 'סטטוס', 'אמצעי תשלום'];
    
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
        paymentMethodStr
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

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const phoneToUse = isExistingUser ? matchingUser.phone : newPledgePhone;

    if (!newPledgeName || (!isExistingUser && !newPledgePhone) || !newPledgeAmount) {
      alert('נא למלא את כל שדות החובה.');
      return;
    }

    onAddPledge({
      type: newPledgeType,
      amount: Number(newPledgeAmount),
      date: newPledgeDate,
      status: 'open'
    }, newPledgeName, phoneToUse);

    setNewPledgeName('');
    setNewPledgePhone('');
    setNewPledgeAmount('');
    setActiveTab('all');
    alert('ההתחייבות נוספה בהצלחה! השם שויך לרשימת ההתחייבויות.');
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

  return (
    <div className="min-h-screen bg-stone-100 pb-12">
      <header className="bg-slate-900 text-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-slate-800 p-1 rounded-lg">
              <img src="https://raw.githubusercontent.com/yosgos365/AM-Donations/main/Logo.jpeg" alt="אחוות מנחם" className="w-10 h-auto object-contain mix-blend-multiply" />
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
            
            {activeTab !== 'users' && (
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
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[650px] text-right">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm font-medium"><tr><th className="p-3 w-28">מושב</th><th className="p-3 w-36">סטטוס</th><th className="p-3">שם בשיבוץ</th><th className="p-3 w-28">פעולה</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...SEATS].sort((a, b) => a.id.localeCompare(b.id, 'en')).map((seat) => {
                      const current = seating[seat.id];
                      const owner = seatEdits[seat.id] ?? current?.owner ?? '';
                      const status = current?.status || 'available';
                      return <tr key={seat.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono font-bold text-slate-700" dir="ltr">{seat.id}</td>
                        <td className="p-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status === 'taken' ? 'bg-emerald-100 text-emerald-700' : status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{status === 'taken' ? 'מאושר' : status === 'pending' ? 'ממתין' : 'פנוי'}</span></td>
                        <td className="p-2"><input value={owner} onChange={(event) => setSeatEdits((currentEdits) => ({ ...currentEdits, [seat.id]: event.target.value }))} placeholder="מושב פנוי" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" /></td>
                        <td className="p-2"><button disabled={savingSeat === seat.id} onClick={async () => { setSavingSeat(seat.id); try { await onUpdateSeat(seat.id, owner.trim()); setSeatEdits((currentEdits) => { const next = { ...currentEdits }; delete next[seat.id]; return next; }); } finally { setSavingSeat(null); } }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60">{savingSeat === seat.id ? 'שומר...' : 'שמור'}</button></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
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
              {users.filter(u => u.role !== 'admin' && (searchTerm ? u.name.includes(searchTerm) || u.phone.includes(searchTerm) : true)).length === 0 ? (
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
                    {users.filter(u => u.role !== 'admin' && (searchTerm ? u.name.includes(searchTerm) || u.phone.includes(searchTerm) : true)).map(u => (
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
                          <td className="p-4">
                            {pledge.status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  className="flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                                  onClick={() => alert('מציג אסמכתא (בדמו לא נשמר קובץ אמיתי, אבל כאן תיפתח התמונה)')}
                                >
                                  <ImageIcon className="w-4 h-4" />
                                  צפה באסמכתא
                                </button>
                                <button
                                  onClick={() => onApprovePledge(pledge.id)}
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
                <p className="text-slate-600 text-sm mb-4">בגלל שאתה במצב תצוגה מקדימה, שמירת האישור תשלום מתבצעת כך:</p>
                <img src={generatedReceipt} alt="אישור תשלום" className="max-w-full h-auto border border-slate-200 shadow-sm mx-auto mb-4 rounded" />
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
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">תיאור/סוג:</span>
                    <span className="font-bold">{receiptPledge.type}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">סכום ששולם:</span>
                    <span className="font-bold text-xl">₪{receiptPledge.amount}</span>
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

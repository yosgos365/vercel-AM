import React, { useState } from 'react';
import { HebrewDatePicker, HebrewDateValue } from './HebrewDatePicker';

interface RegistrationProps {
  initialPhone: string;
  onRegister: (user: { name: string; phone: string; hebrewDob: HebrewDateValue }) => void;
  onCancel: () => void;
}

export function Registration({ initialPhone, onRegister, onCancel }: RegistrationProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState(initialPhone);
  const [hebrewDob, setHebrewDob] = useState<HebrewDateValue | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !phone || !hebrewDob) {
      alert('נא למלא את כל השדות');
      return;
    }
    onRegister({
      name: `${firstName} ${lastName}`,
      phone,
      hebrewDob
    });
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 p-6 sm:p-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800">ברוך הבא! 🌟</h2>
        <p className="text-slate-500 mt-2">מספר הטלפון לא רשום במערכת. אנא הירשם.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">שם פרטי</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">שם משפחה</label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">מספר טלפון</label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
          />
        </div>

        <div>
          <HebrewDatePicker
            label="תאריך לידה עברי"
            value={hebrewDob}
            onChange={setHebrewDob}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
          >
            חזור
          </button>
          <button
            type="submit"
            className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/30 hover:bg-indigo-700 transition-all transform hover:-translate-y-0.5"
          >
            הרשמה
          </button>
        </div>
      </form>
    </div>
  );
}

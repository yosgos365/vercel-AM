import React, { useState } from 'react';
import { LogIn, Lock, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLogin: (phone: string) => void;
  onAdminLogin: (password: string) => void;
  error?: string;
}

export function Login({ onLogin, onAdminLogin, error }: LoginProps) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdminMode) {
      onAdminLogin(password);
    } else {
      onLogin(phone);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative" dir="rtl">
      <button 
        onClick={() => { setIsAdminMode(!isAdminMode); setPhone(''); setPassword(''); }} 
        className="absolute top-6 left-6 flex items-center gap-2 text-stone-600 hover:text-blue-600 font-medium transition-colors"
      >
        {isAdminMode ? <ArrowRight className="w-5 h-5" /> : <><Lock className="w-5 h-5" /> <span className="text-sm sm:text-base">כניסת מנהל</span></>}
      </button>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600">
          <img src="/logo-no-text.jpeg" alt="אחוות מנחם" className="w-32 h-auto object-contain mix-blend-multiply" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-stone-900">
          {isAdminMode ? 'כניסת מנהל' : 'אזור אישי - אחוות מנחם'}
        </h2>
        <p className="mt-2 text-center text-sm text-stone-600">
          {isAdminMode ? 'מערכת ניהול התחייבויות קהילה' : 'צפייה וניהול התחייבויות, תרומות ונדרים'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-stone-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {isAdminMode ? (
              <div>
                <label className="block text-sm font-medium text-stone-700">
                  סיסמת מנהל
                </label>
                <div className="mt-1">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm placeholder-stone-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-left"
                    dir="ltr"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-stone-700">
                  מספר טלפון נייד
                </label>
                <div className="mt-1">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="05X-XXXXXXX"
                    className="appearance-none block w-full px-3 py-2 border border-stone-300 rounded-md shadow-sm placeholder-stone-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-left"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={10}
                    pattern="(?:05[0-9]{8}|050)"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm font-medium">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                {isAdminMode ? 'התחברות לניהול' : 'כניסה לאזור האישי'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

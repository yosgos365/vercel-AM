import React, { useState } from 'react';
import { Pledge } from '../types';
import { Upload, X, CheckCircle2, Wallet, Building2 } from 'lucide-react';

interface PaymentModalProps {
  pledges: Pledge[];
  onClose: () => void;
  onSubmit: (method: 'paybox' | 'bank', file: File | null) => void;
}

export function PaymentModal({ pledges, onClose, onSubmit }: PaymentModalProps) {
  const [method, setMethod] = useState<'paybox' | 'bank'>('paybox');
  const [file, setFile] = useState<File | null>(null);
  const total = pledges.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
          <h2 className="text-xl font-bold text-slate-800">ביצוע תשלום</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-slate-50 border border-slate-200 text-slate-800 p-4 rounded-lg mb-6 flex justify-between items-center">
            <span className="font-medium">סה"כ לתשלום:</span>
            <span className="text-2xl font-bold text-indigo-700">₪{total}</span>
          </div>

          <h3 className="font-medium text-slate-700 mb-3">בחר אמצעי תשלום:</h3>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => setMethod('paybox')}
              className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                method === 'paybox' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Wallet className={`w-6 h-6 ${method === 'paybox' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span className={`font-medium ${method === 'paybox' ? 'text-indigo-700' : 'text-slate-600'}`}>PayBox</span>
            </button>
            <button
              onClick={() => setMethod('bank')}
              className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                method === 'bank' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Building2 className={`w-6 h-6 ${method === 'bank' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span className={`font-medium ${method === 'bank' ? 'text-indigo-700' : 'text-slate-600'}`}>העברה בנקאית</span>
            </button>
          </div>

          {method === 'paybox' && (
            <div className="bg-indigo-50/50 p-4 rounded-lg mb-6 border border-indigo-100 flex flex-col items-center">
              <a
                href="https://links.payboxapp.com/CrEzbkwjMUb"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-lg transition-colors mb-3"
              >
                למעבר לתשלום ב־PayBox
              </a>
              <p className="text-sm font-semibold text-indigo-800 text-center">
                לאחר התשלום חזרו לעמוד זה והעלו צילום מסך של ההעברה.
              </p>
            </div>
          )}

          {method === 'bank' && (
            <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200 space-y-2 text-center text-slate-700">
              <p>בנק: <span className="font-bold">פועלים (12)</span></p>
              <p>סניף: <span className="font-bold">123</span></p>
              <p>חשבון: <span className="font-bold">123456</span></p>
              <p>שם החשבון: <span className="font-bold">בית כנסת אוהל משה</span></p>
            </div>
          )}

          <h3 className="font-medium text-slate-700 mb-3">העלאת אסמכתא (צילום מסך / קבלה):</h3>
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative bg-white">
            <input 
              type="file" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <>
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mb-2" />
                <p className="font-medium text-slate-800">{file.name}</p>
                <p className="text-sm text-slate-500 mt-1">לחץ להחלפת קובץ</p>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 text-slate-400 mb-2" />
                <p className="font-medium text-slate-700">לחץ כאן לבחירת קובץ</p>
                <p className="text-sm text-slate-500 mt-1">תומך בתמונות ו-PDF</p>
              </>
            )}
          </div>
        </div>
        
        <div className="p-4 border-t border-slate-200 bg-white">
          <button
            onClick={() => onSubmit(method, file)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            שלח אסמכתא לאישור גבאי
          </button>
        </div>
      </div>
    </div>
  );
}

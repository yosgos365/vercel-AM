# פריסה ל-Vercel

תיקייה זו מיועדת לפריסה ב-Vercel. היא נפרדת מגרסת Netlify ואינה כוללת
`node_modules`, תיקיית build או סודות.

## הגדרות בפרויקט Vercel

ייבא את תיקיית המקור הזו ל-GitHub, או חבר את המאגר שמכיל אותה.

ב־Vercel בחר:

- Framework: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

הגדר את משתני הסביבה הבאים ב־Production, Preview ו־Development:

- `USE_FIRESTORE=true`
- `FIREBASE_SERVICE_ACCOUNT_JSON` — תוכן קובץ מפתח השירות של Firebase, כולו בשורה אחת
- `DEVELOPER_PASSWORD` — סיסמת המפתח הרצויה

צילומי התשלום נשמרים ב־Firebase Storage הפרטי של הפרויקט. אין צורך
ב־Google Drive או ב־Google Apps Script.

הפונקציה `api/[...path].ts` מטפלת בכל כתובות `/api/*`. קובץ `vercel.json`
מחזיר את שאר הכתובות ל־React, כך שפתיחה ישירה של `/select` או
`/admin/dashboard` לא תחזיר 404.

אין להעלות את קובץ מפתח השירות של Firebase או קובץ `.env` ל־GitHub.

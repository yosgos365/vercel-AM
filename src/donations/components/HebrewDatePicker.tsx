import React, { useMemo, useEffect } from 'react';
import { HDate, gematriya } from '@hebcal/core';

export interface HebrewDateValue {
  year: number;
  month: number;
  day: number;
}

interface HebrewDatePickerProps {
  value: HebrewDateValue | null;
  onChange: (value: HebrewDateValue) => void;
  label?: string;
}

const hebrewMonthsMap: Record<number, string> = {
  7: 'תשרי',
  8: 'חשוון',
  9: 'כסלו',
  10: 'טבת',
  11: 'שבט',
  12: 'אדר',
  13: 'אדר ב׳',
  1: 'ניסן',
  2: 'אייר',
  3: 'סיוון',
  4: 'תמוז',
  5: 'אב',
  6: 'אלול',
};

const getMonthsForYear = (year: number) => {
  const isLeap = HDate.isLeapYear(year);
  const months = [
    { value: 7, label: 'תשרי' },
    { value: 8, label: 'חשוון' },
    { value: 9, label: 'כסלו' },
    { value: 10, label: 'טבת' },
    { value: 11, label: 'שבט' },
  ];
  
  if (isLeap) {
    months.push({ value: 12, label: 'אדר א׳' });
    months.push({ value: 13, label: 'אדר ב׳' });
  } else {
    months.push({ value: 12, label: 'אדר' });
  }
  
  months.push(
    { value: 1, label: 'ניסן' },
    { value: 2, label: 'אייר' },
    { value: 3, label: 'סיוון' },
    { value: 4, label: 'תמוז' },
    { value: 5, label: 'אב' },
    { value: 6, label: 'אלול' }
  );
  
  return months;
};

export function HebrewDatePicker({ value, onChange, label = 'תאריך עברי' }: HebrewDatePickerProps) {
  // Default to today if not provided, or a specific default year
  const currentYear = new HDate().getFullYear();
  const selectedYear = value?.year || currentYear;
  const isLeap = HDate.isLeapYear(selectedYear);
  
  // Fix month if it was Adar II but year changed to non-leap
  const selectedMonth = value?.month || 7;
  const validMonth = (!isLeap && selectedMonth === 13) ? 12 : selectedMonth;
  
  // Fix day if it exceeds days in month
  const selectedDay = value?.day || 1;
  const maxDaysInMonth = HDate.daysInMonth(validMonth, selectedYear);
  const validDay = Math.min(selectedDay, maxDaysInMonth);
  
  // Ensure we call onChange if we auto-corrected
  useEffect(() => {
    if (value && (validMonth !== selectedMonth || validDay !== selectedDay)) {
      onChange({ year: selectedYear, month: validMonth, day: validDay });
    }
  }, [selectedYear, selectedMonth, selectedDay, validMonth, validDay, value, onChange]);

  const years = useMemo(() => {
    const list = [];
    for (let y = 5787; y >= 5700; y--) {
      list.push({ value: y, label: gematriya(y) });
    }
    return list;
  }, []);

  const months = useMemo(() => getMonthsForYear(selectedYear), [selectedYear]);
  
  const days = useMemo(() => {
    const list = [];
    for (let d = 1; d <= maxDaysInMonth; d++) {
      list.push({ value: d, label: gematriya(d) });
    }
    return list;
  }, [maxDaysInMonth]);

  const handleChange = (field: keyof HebrewDateValue, newVal: number) => {
    if (!value) {
      // First selection, initialize
      const newDate: HebrewDateValue = {
        year: field === 'year' ? newVal : selectedYear,
        month: field === 'month' ? newVal : validMonth,
        day: field === 'day' ? newVal : validDay,
      };
      onChange(newDate);
      return;
    }
    onChange({ ...value, year: selectedYear, month: validMonth, day: validDay, [field]: newVal });
  };

  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
      <div className="flex gap-2" dir="rtl">
        <select
          value={value?.day || ''}
          onChange={(e) => handleChange('day', parseInt(e.target.value))}
          className="w-1/3 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="" disabled>יום</option>
          {days.map(d => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        
        <select
          value={value?.month || ''}
          onChange={(e) => handleChange('month', parseInt(e.target.value))}
          className="w-1/3 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="" disabled>חודש</option>
          {months.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        
        <select
          value={value?.year || ''}
          onChange={(e) => handleChange('year', parseInt(e.target.value))}
          className="w-1/3 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="" disabled>שנה</option>
          {years.map(y => (
            <option key={y.value} value={y.value}>{y.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

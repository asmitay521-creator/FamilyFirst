import React, { useState, useEffect } from 'react';
import { Clock, IndianRupee, Sparkles, Calendar, Save, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import Modal from '@comps/common/Modal';
import { DatePicker } from '@comps/common/DatePicker';
import { SeminarConfig } from './index';

interface SeminarConfigModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: 'time' | 'fee' | 'all';
  config: SeminarConfig;
  onSave: (updated: SeminarConfig) => Promise<void> | void;
  saving?: boolean;
}

function parseDateStringToIso(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return format(d, 'yyyy-MM-dd');
    }
  } catch (e) {}
  return '';
}

export default function SeminarConfigModal({
  open,
  onClose,
  initialTab = 'time',
  config,
  onSave,
  saving = false,
}: SeminarConfigModalProps) {
  const [activeTab, setActiveTab] = useState<'time' | 'fee' | 'all'>(initialTab);
  const [formData, setFormData] = useState<SeminarConfig>(config);

  useEffect(() => {
    setFormData(config);
  }, [config]);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab || 'time');
      setFormData(config);
    }
  }, [open, initialTab, config]);

  const handleDateSelect = (isoOrText: string) => {
    if (!isoOrText) return;
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrText)) {
        const [y, m, d] = isoOrText.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        if (!isNaN(dateObj.getTime())) {
          const formattedDate = format(dateObj, 'dd MMMM yyyy');
          const dayName = format(dateObj, 'EEEE');
          setFormData((prev) => ({
            ...prev,
            date: formattedDate,
            day: dayName,
          }));
          return;
        }
      }
      const parsed = new Date(isoOrText);
      if (!isNaN(parsed.getTime())) {
        const formattedDate = format(parsed, 'dd MMMM yyyy');
        const dayName = format(parsed, 'EEEE');
        setFormData((prev) => ({
          ...prev,
          date: formattedDate,
          day: dayName,
        }));
        return;
      }
      setFormData((prev) => ({ ...prev, date: isoOrText }));
    } catch {
      setFormData((prev) => ({ ...prev, date: isoOrText }));
    }
  };

  const handleQuickDate = (daysFromNow: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    const iso = format(target, 'yyyy-MM-dd');
    handleDateSelect(iso);
  };

  const handleNextSunday = () => {
    const today = new Date();
    const day = today.getDay(); // 0 is Sunday
    const daysUntilNextSunday = day === 0 ? 7 : 7 - day;
    handleQuickDate(daysUntilNextSunday);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Seminar Settings (सेमिनार सेटिंग्ज)"
      subtitle="Update the live seminar schedule time, date, and registration fee."
      size="lg"
      heightClass="h-[520px] max-h-[85vh]"
      icon={<Sparkles size={20} className="text-purple-600" />}
      footerActions={
        <div className="flex items-center justify-between w-full">
          <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
            * बदल सेव्ह केल्यावर मुख्य पेजवर व वेबसाईटवर त्वरित अपडेट होईल
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-all"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2"
              onClick={handleSubmit}
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              Save & Update
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-[440px] min-h-[440px] py-1">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('time')}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border flex items-center gap-2',
              activeTab === 'time'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/20'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
          >
            <Clock size={14} />
            <span>Time & Date (वेळ व तारीख)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fee')}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border flex items-center gap-2',
              activeTab === 'fee'
                ? 'bg-amber-600 text-white border-amber-600 shadow-amber-500/20'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
          >
            <IndianRupee size={14} />
            <span>Seminar Fee (नोंदणी फी)</span>
          </button>
        </div>

        {/* Scrollable Content Area with Constant Height */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
          {/* TAB 1: TIME & SCHEDULE */}
          {(activeTab === 'time' || activeTab === 'all') && (
            <div className="space-y-4 pt-1">
              {/* Quick Time Presets */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block mb-2">
                  Quick Time Presets (वेळेचे पर्याय)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    '11:00 AM – 01:00 PM (IST)',
                    '10:00 AM – 12:00 PM (IST)',
                    '03:00 PM – 05:00 PM (IST)',
                    '05:00 PM – 07:00 PM (IST)',
                    '06:00 PM – 08:00 PM (IST)',
                    '07:00 PM – 09:00 PM (IST)',
                  ].map((t) => {
                    const isSelected = formData.time === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, time: t }))}
                        className={clsx(
                          'p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center shadow-2xs',
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/20 scale-[1.02]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Time String Input */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Seminar Time (वेळ) <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Clock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.time || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, time: e.target.value }))}
                    placeholder="11:00 AM – 01:00 PM (IST)"
                    className="input w-full pl-10 py-2.5 font-bold text-indigo-700 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Date & Day Fields with Interactive DatePicker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Seminar Date (तारीख निवडा) <span className="text-red-500 font-bold">*</span>
                  </label>
                  <DatePicker
                    value={parseDateStringToIso(formData.date)}
                    onDateChange={handleDateSelect}
                    onChange={(e: any) => handleDateSelect(e?.target?.value || e)}
                    placeholder="तारीख निवडा (DD/MM/YYYY)"
                    className="input w-full py-2.5 font-bold text-slate-800 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {formData.date && (
                    <div className="text-[11px] text-indigo-700 font-bold mt-1.5 flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                      <Calendar size={13} className="text-indigo-600" />
                      <span>
                        निवडलेली तारीख: <span className="underline">{formData.date}</span> ({formData.day || 'Sunday'})
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Day of Week (वार) <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.day || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, day: e.target.value }))}
                    placeholder="Sunday"
                    className="input w-full px-3.5 py-2.5 font-bold text-slate-800 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Quick Date & Day Shortcuts */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Quick Date & Day Shortcuts (तारीख शॉर्टकट)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleNextSunday()}
                    className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all cursor-pointer shadow-2xs"
                  >
                    📅 या / पुढील रविवारी (Sunday)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDate(1)}
                    className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    उद्या (Tomorrow)
                  </button>
                  {['Sunday', 'Saturday', 'Friday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, day: d }))}
                      className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border',
                        formData.day === d
                          ? 'bg-indigo-600 text-white border-indigo-600 font-black shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SEMINAR FEE (Price) */}
          {(activeTab === 'fee' || activeTab === 'all') && (
            <div className="space-y-4 pt-1">
              {/* Quick Fee Presets */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block mb-2">
                  Quick Fee Presets (नोंदणी फी पर्याय)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: 'FREE (₹0)', value: '0' },
                    { label: '₹99 /-', value: '99' },
                    { label: '₹199 /-', value: '199' },
                    { label: '₹299 /-', value: '299' },
                    { label: '₹499 /-', value: '499' },
                    { label: '₹999 /-', value: '999' },
                  ].map((p) => {
                    const isSelected = formData.price === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, price: p.value }))}
                        className={clsx(
                          'p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center shadow-2xs',
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-600 shadow-amber-500/20 scale-[1.02]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Fee Amount Input */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Seminar Registration Fee (नोंदणी फी रक्कम ₹) <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <IndianRupee size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500" />
                  <input
                    type="text"
                    required
                    value={formData.price || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value.replace(/\D/g, '') }))}
                    placeholder="199"
                    className="input w-full pl-10 py-2.5 font-bold text-amber-700 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  '0' टाका मोफत नोंदणीसाठी, किंवा आवश्यक ती रक्कम (₹) टाका.
                </p>
              </div>
            </div>
          )}
        </div>




      </form>
    </Modal>
  );
}

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface CountryCodeOption {
  code: string; // Dial code digits without +, e.g. '91'
  country: string; // e.g. 'India'
  dialCode: string; // e.g. '+91'
}

export const COUNTRY_CODES: CountryCodeOption[] = [
  { code: '91', country: 'India', dialCode: '+91' },
  { code: '1', country: 'United States', dialCode: '+1' },
  { code: '1', country: 'Canada', dialCode: '+1' },
  { code: '44', country: 'United Kingdom', dialCode: '+44' },
  { code: '971', country: 'United Arab Emirates', dialCode: '+971' },
  { code: '966', country: 'Saudi Arabia', dialCode: '+966' },
  { code: '65', country: 'Singapore', dialCode: '+65' },
  { code: '61', country: 'Australia', dialCode: '+61' },
  { code: '49', country: 'Germany', dialCode: '+49' },
  { code: '33', country: 'France', dialCode: '+33' },
  { code: '81', country: 'Japan', dialCode: '+81' },
  { code: '86', country: 'China', dialCode: '+86' },
  { code: '974', country: 'Qatar', dialCode: '+974' },
  { code: '968', country: 'Oman', dialCode: '+968' },
  { code: '965', country: 'Kuwait', dialCode: '+965' },
  { code: '973', country: 'Bahrain', dialCode: '+973' },
  { code: '94', country: 'Sri Lanka', dialCode: '+94' },
  { code: '977', country: 'Nepal', dialCode: '+977' },
  { code: '880', country: 'Bangladesh', dialCode: '+880' },
  { code: '60', country: 'Malaysia', dialCode: '+60' },
  { code: '62', country: 'Indonesia', dialCode: '+62' },
  { code: '63', country: 'Philippines', dialCode: '+63' },
  { code: '66', country: 'Thailand', dialCode: '+66' },
  { code: '84', country: 'Vietnam', dialCode: '+84' },
  { code: '27', country: 'South Africa', dialCode: '+27' },
  { code: '234', country: 'Nigeria', dialCode: '+234' },
  { code: '254', country: 'Kenya', dialCode: '+254' },
  { code: '55', country: 'Brazil', dialCode: '+55' },
  { code: '52', country: 'Mexico', dialCode: '+52' },
  { code: '7', country: 'Russia', dialCode: '+7' },
  { code: '39', country: 'Italy', dialCode: '+39' },
  { code: '34', country: 'Spain', dialCode: '+34' },
  { code: '31', country: 'Netherlands', dialCode: '+31' },
  { code: '41', country: 'Switzerland', dialCode: '+41' },
  { code: '46', country: 'Sweden', dialCode: '+46' },
  { code: '47', country: 'Norway', dialCode: '+47' },
  { code: '45', country: 'Denmark', dialCode: '+45' },
  { code: '353', country: 'Ireland', dialCode: '+353' },
  { code: '64', country: 'New Zealand', dialCode: '+64' }
];

interface CountryPhoneInputProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const CountryPhoneInput: React.FC<CountryPhoneInputProps> = ({
  value = '',
  onChange,
  disabled = false,
  placeholder = 'Enter mobile number',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const rawDigits = (value || '').replace(/\D/g, '');

  // Detect matching country code
  const currentOption = useMemo(() => {
    if (!rawDigits) return COUNTRY_CODES[0]; // India +91 default
    const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
    const match = sorted.find(c => rawDigits.startsWith(c.code));
    return match || COUNTRY_CODES[0];
  }, [rawDigits]);

  const phoneDigits = rawDigits.startsWith(currentOption.code)
    ? rawDigits.slice(currentOption.code.length)
    : rawDigits;

  // Position popover on open
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

  // Outside click listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectCountry = (c: CountryCodeOption) => {
    setIsOpen(false);
    setSearch('');
    onChange(`${c.code}${phoneDigits}`);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
    onChange(newDigits ? `${currentOption.code}${newDigits}` : '');
  };

  const filteredCountries = COUNTRY_CODES.filter(
    (c) =>
      c.country.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search) ||
      c.code.includes(search)
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={`flex items-center w-full border border-slate-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all ${
          disabled ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''
        }`}
      >
        {/* Compact Dial Code Selector Button */}
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex flex-wrap items-center gap-1 px-2.5 py-1.5 border-r border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-extrabold text-xs rounded-l-xl transition-colors cursor-pointer select-none shrink-0"
        >
          <span>{currentOption.dialCode}</span>
          <ChevronDown size={13} className="text-slate-400" />
        </button>

        {/* Phone Input */}
        <input
          type="tel"
          disabled={disabled}
          maxLength={10}
          value={phoneDigits}
          onChange={handlePhoneChange}
          placeholder={placeholder}
          className="w-full py-1.5 px-2.5 text-xs bg-transparent text-slate-800 placeholder-slate-400 font-medium focus:outline-none"
        />
      </div>

      {/* Floating Dropdown Popover with Search Box */}
      {isOpen && !disabled && (
        <div
          style={{ top: popoverPos.top, left: popoverPos.left }}
          className="fixed w-52 max-h-56 bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] overflow-hidden flex flex-col animate-fadeIn"
        >
          {/* Small Search Box */}
          <div className="p-1.5 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-1.5">
            <Search size={13} className="text-slate-400 shrink-0 ml-1" />
            <input
              type="text"
              autoFocus
              className="w-full text-xs py-1 px-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-slate-400 hover:text-slate-600 mr-1"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Country List (No Flags, Dial Code + Country) */}
          <div className="overflow-y-auto max-h-44 divide-y divide-slate-50">
            {filteredCountries.length === 0 ? (
              <div className="p-2 text-center text-xs text-slate-400">No country found</div>
            ) : (
              filteredCountries.map((c, idx) => (
                <button
                  key={`${c.code}-${c.country}-${idx}`}
                  type="button"
                  onClick={() => handleSelectCountry(c)}
                  className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between hover:bg-blue-50 transition-colors cursor-pointer ${
                    currentOption.code === c.code && currentOption.country === c.country
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700'
                  }`}
                >
                  <span className="truncate pr-2 font-medium">{c.country}</span>
                  <span className="font-extrabold text-slate-500 shrink-0">{c.dialCode}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

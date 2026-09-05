import React, { forwardRef, useRef, useImperativeHandle, useState, useEffect, useCallback } from 'react';
import { format, isValid } from 'date-fns';
import { Calendar, X } from 'lucide-react';

interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string | null | any;
  onChange?: (val: any) => void;
  onDateChange?: (val: string) => void;
  className?: string;
  placeholder?: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/** ISO yyyy-MM-dd → display DD/MM/YYYY (e.g. 31/07/2026) */
function toDisplay(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return format(d, 'dd/MM/yyyy');
  } catch { /* ignore */ }
  return '';
}

/** Parse DD/MMM/YYYY or DD/MM/YYYY string → ISO yyyy-MM-dd string (or '' if invalid) */
function parseDateString(text: string, allowTwoDigitYear = false): string {
  if (!text) return '';
  const trimmed = text.trim();

  let day: number | undefined;
  let mon: number | undefined;
  let year: number | undefined;

  // Pure 8 digits: 31072026
  if (/^\d{8}$/.test(trimmed)) {
    day = parseInt(trimmed.slice(0, 2), 10);
    mon = parseInt(trimmed.slice(2, 4), 10) - 1;
    year = parseInt(trimmed.slice(4, 8), 10);
  }
  // Separated parts: 31/Jul/2026 or 31/07/2026 or 31-07-2026 or 31/Jul/26
  else {
    const parts = trimmed.split(/[\/\-\.\s]+/);
    if (parts.length === 3) {
      day = parseInt(parts[0], 10);
      const mStr = parts[1].toLowerCase();
      if (/^\d+$/.test(mStr)) {
        mon = parseInt(mStr, 10) - 1;
      } else if (MONTHS[mStr] !== undefined) {
        mon = MONTHS[mStr];
      }
      const yStr = parts[2];
      if (/^\d{4}$/.test(yStr)) {
        year = parseInt(yStr, 10);
      } else if (allowTwoDigitYear && /^\d{2}$/.test(yStr)) {
        const yNum = parseInt(yStr, 10);
        const currTwoDigit = new Date().getFullYear() % 100;
        year = yNum > currTwoDigit ? 1900 + yNum : 2000 + yNum;
      }
    }
  }

  if (day === undefined || mon === undefined || year === undefined) return '';
  if (isNaN(day) || isNaN(mon) || isNaN(year)) return '';
  if (mon < 0 || mon > 11 || day < 1 || day > 31 || year < 1900 || year > 2100) return '';

  const d = new Date(year, mon, day);
  if (!isValid(d) || d.getFullYear() !== year || d.getMonth() !== mon || d.getDate() !== day) return '';

  return format(d, 'yyyy-MM-dd');
}

/** Auto-format masked string as user types, adding slashes automatically and advancing segment */
function formatMasked(input: string): string {
  // Strip non-alphanumeric
  const clean = input.replace(/[^0-9a-zA-Z]/g, '');
  if (!clean) return '';

  // Extract day (first up to 2 digits)
  const dayMatch = clean.match(/^(\d{1,2})/);
  if (!dayMatch) return input;

  const dayStr = dayMatch[1];
  const rest = clean.slice(dayStr.length);

  let result = dayStr;

  // Add first slash if 2 digits of day entered or month started
  if (dayStr.length === 2 || rest.length > 0) {
    result += '/';
  } else {
    return result;
  }

  if (!rest) return result;

  // Check if rest starts with letters or numbers
  const isLetterMonth = /^[A-Za-z]/.test(rest);

  if (isLetterMonth) {
    const monthMatch = rest.match(/^([A-Za-z]{1,3})/);
    const monRaw = monthMatch ? monthMatch[1] : '';
    const monStr = monRaw ? monRaw.charAt(0).toUpperCase() + monRaw.slice(1).toLowerCase() : '';
    const yearStr = rest.slice(monRaw.length).replace(/\D/g, '').slice(0, 4);

    result += monStr;
    if (monStr.length === 3 || yearStr.length > 0) {
      result += '/';
      if (yearStr) {
        result += yearStr;
      }
    }
    return result;
  } else {
    // Numeric month — keep as numbers (no conversion to letter names)
    const monthMatch = rest.match(/^(\d{1,2})/);
    const monRaw = monthMatch ? monthMatch[1] : '';
    const monStr = monRaw;

    const yearStr = rest.slice(monRaw.length).replace(/\D/g, '').slice(0, 4);

    result += monStr;
    if (monRaw.length === 2 || yearStr.length > 0) {
      result += '/';
      if (yearStr) {
        result += yearStr;
      }
    }
    return result;
  }
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ value, onChange, onDateChange, className, placeholder = 'DD/MM/YYYY', disabled, required, ...props }, ref) => {
    const nativeInputRef = useRef<HTMLInputElement | null>(null);
    const [isoValue, setIsoValue] = useState(value || '');
    const [typedText, setTypedText] = useState(toDisplay(value || ''));
    const [isTyping, setIsTyping] = useState(false);

    useImperativeHandle(ref, () => nativeInputRef.current!);

    // Sync when value prop changes externally
    useEffect(() => {
      if (!isTyping) {
        setIsoValue(value || '');
        setTypedText(toDisplay(value || ''));
      }
    }, [value, isTyping]);

    const setRef = useCallback((node: HTMLInputElement | null) => {
      nativeInputRef.current = node;
      if (node) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (descriptor?.set) {
          const originalSet = descriptor.set;
          Object.defineProperty(node, 'value', {
            configurable: true,
            set(val: string) {
              originalSet.call(this, val);
              setIsoValue(val);
              setTypedText(toDisplay(val));
            },
            get() {
              return descriptor.get ? descriptor.get.call(this) : '';
            },
          });
        }
      }
    }, []);

    const fireChange = (iso: string) => {
      if (onDateChange) onDateChange(iso);
      if (onChange) {
        const fakeEvent = { target: { value: iso }, toString: () => iso, valueOf: () => iso } as any;
        onChange(fakeEvent);
      }
    };

    const handleTextInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsTyping(true);
      const val = e.target.value;
      const isDeleting = val.length < typedText.length;

      if (isDeleting) {
        const trimmed = val.endsWith('/') ? val.slice(0, -1) : val;
        setTypedText(trimmed);
        const iso = parseDateString(trimmed);
        if (iso) {
          setIsoValue(iso);
          fireChange(iso);
        } else if (!trimmed.trim()) {
          setIsoValue('');
          fireChange('');
        }
        return;
      }

      const formatted = formatMasked(val);
      setTypedText(formatted);

      const iso = parseDateString(formatted) || parseDateString(val);
      if (iso) {
        setIsoValue(iso);
        fireChange(iso);
      } else if (!val.trim()) {
        setIsoValue('');
        fireChange('');
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === '/') {
        e.preventDefault();
        const parts = typedText.split('/');
        if (parts.length === 1 && parts[0].length > 0) {
          const dayPadded = parts[0].padStart(2, '0');
          setTypedText(dayPadded + '/');
        } else if (parts.length === 2 && parts[1].length > 0) {
          const monStr = parts[1]; // keep numeric month as-is
          setTypedText(parts[0] + '/' + monStr + '/');
        }
      }
    };

    const handleTextBlur = () => {
      setIsTyping(false);
      let iso = parseDateString(typedText, true);

      // If typedText has day and month but incomplete year, attempt completing year without wiping selected date
      if (!iso && typedText.trim()) {
        const parts = typedText.trim().split(/[\/\-\.\s]+/);
        if (parts.length >= 2) {
          const day = parseInt(parts[0], 10);
          const mStr = parts[1].toLowerCase();
          const mon = /^\d+$/.test(mStr) ? parseInt(mStr, 10) - 1 : MONTHS[mStr];

          if (!isNaN(day) && mon !== undefined && mon >= 0 && mon <= 11 && day >= 1 && day <= 31) {
            let fallbackYear = new Date().getFullYear();
            if (isoValue) {
              const prevYear = parseInt(isoValue.split('-')[0], 10);
              if (!isNaN(prevYear)) fallbackYear = prevYear;
            }
            const yStr = parts[2] || '';
            if (yStr.length > 0 && /^\d+$/.test(yStr)) {
              if (yStr.length === 1) fallbackYear = parseInt(`200${yStr}`, 10);
              else if (yStr.length === 3) fallbackYear = parseInt(`2${yStr}`, 10);
            }
            const testIso = `${fallbackYear}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (parseDateString(toDisplay(testIso))) {
              iso = testIso;
            }
          }
        }
      }

      if (iso) {
        setTypedText(toDisplay(iso));
        setIsoValue(iso);
        fireChange(iso);
      } else if (!typedText.trim()) {
        setTypedText('');
        setIsoValue('');
        fireChange('');
      }
    };

    const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const iso = e.target.value;
      setIsoValue(iso);
      setTypedText(toDisplay(iso));
      setIsTyping(false);
      fireChange(iso);
    };

    const handleCalendarClick = (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        if (nativeInputRef.current && typeof nativeInputRef.current.showPicker === 'function') {
          nativeInputRef.current.showPicker();
        } else {
          nativeInputRef.current?.click();
        }
      } catch {
        nativeInputRef.current?.click();
      }
    };

    return (
      <div className="relative w-full min-w-[130px]">
        {/* Editable visible input */}
        <input
          type="text"
          value={typedText}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          onChange={handleTextInput}
          onKeyDown={handleKeyDown}
          onBlur={handleTextBlur}
          onFocus={() => setIsTyping(true)}
          className={`${className} cursor-text pl-2.5 pr-7 text-gray-900 text-xs min-w-[130px]`}
          maxLength={11}
          autoComplete="off"
        />

        {/* Clear & Calendar icon buttons */}
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {typedText && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTypedText('');
                setIsoValue('');
                if (onChange) onChange('');
                if (onDateChange) onDateChange('');
              }}
              className="text-gray-400 hover:text-rose-500 transition-colors p-0.5 rounded-full hover:bg-gray-100 cursor-pointer"
              aria-label="Clear date"
              title="Clear Date"
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={handleCalendarClick}
            className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
            aria-label="Open date picker"
          >
            <Calendar size={14} />
          </button>
        </div>

        {/* Hidden native date input for calendar popup */}
        <input
          type="date"
          ref={setRef}
          value={isoValue}
          onChange={handleNativeDateChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
          tabIndex={-1}
          {...props}
        />
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';

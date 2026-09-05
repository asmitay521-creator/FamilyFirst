const EMP_PASS_STORAGE_KEY = 'ff_employee_passwords_store_v1';

const DEFAULT_EMPLOYEE_PASSWORDS: Record<string, string> = {
  'superadmin123@gmail.com': 'Password@123',
  'gay@gmail.com': 'Gayatri@123',
  'vaishu123@gmail.com': 'Vaishnavi@123',
  'asmi@gmail.com': 'Asmita@123',
  '9876562345': 'Gayatri@123',
  '9876543210': 'Vaishnavi@123',
  '8798654354': 'Asmita@123',
};

export function getStoredEmployeePassword(emp: any): string {
  if (!emp) return '';
  const email = (emp.email || emp.user?.email || '').toLowerCase().trim();
  const phone = (emp.phone || '').replace(/\D/g, '').slice(-10);
  const id = emp.id || emp.userId || emp.user?.id || '';
  const firstName = (emp.firstName || '').trim();

  try {
    const raw = localStorage.getItem(EMP_PASS_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};

    if (id && map[id]) return map[id];
    if (email && map[email]) return map[email];
    if (phone && map[phone]) return map[phone];

    // Check API response fields if provided
    if (emp.password) return emp.password;
    if (emp.user?.password) return emp.user.password;
    if (emp.plainPassword) return emp.plainPassword;
    if (emp.user?.plainPassword) return emp.user.plainPassword;

    // Check pre-configured defaults
    if (email && DEFAULT_EMPLOYEE_PASSWORDS[email]) return DEFAULT_EMPLOYEE_PASSWORDS[email];
    if (phone && DEFAULT_EMPLOYEE_PASSWORDS[phone]) return DEFAULT_EMPLOYEE_PASSWORDS[phone];

    if (firstName) {
      const capitalized = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
      return `${capitalized}@123`;
    }
  } catch {}

  return emp.password || emp.user?.password || emp.plainPassword || emp.user?.plainPassword || '';
}

export function saveStoredEmployeePassword(
  identifiers: { id?: string; email?: string; phone?: string; firstName?: string },
  password: string
) {
  if (!password || !password.trim()) return;
  try {
    const raw = localStorage.getItem(EMP_PASS_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};

    const cleanPass = password.trim();
    if (identifiers.id) map[identifiers.id] = cleanPass;
    if (identifiers.email) map[identifiers.email.toLowerCase().trim()] = cleanPass;
    if (identifiers.phone) map[identifiers.phone.replace(/\D/g, '').slice(-10)] = cleanPass;

    localStorage.setItem(EMP_PASS_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

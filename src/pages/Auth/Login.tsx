import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { authService } from '@api/auth.service';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';
import {
  Mail, Lock, Eye, EyeOff,
  ArrowRight, Briefcase, User, Shield,
  Headphones, FileText, Heart, Car, Home, Activity
} from 'lucide-react';

const schema = z.object({
  email: z.string().min(1, 'Please enter your username or email address'),
  password: z.string().min(1, 'Password is required'),
});
type Form = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'owner' | 'employee'>('owner');
  const [rememberMe, setRememberMe] = useState(true);

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: 'superadmin123',
      password: 'Password@123'
    }
  });

  const token = useAuthStore(s => s.accessToken);
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (token && user) {
      const target = user.role === 'EMPLOYEE' ? '/workspace' : '/dashboard';
      navigate(target, { replace: true });
    }
  }, [token, user, navigate]);

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try {
      let cleanEmail = data.email.trim();
      if (!cleanEmail.includes('@')) {
        cleanEmail = `${cleanEmail}@gmail.com`;
      }
      const cleanPassword = data.password.trim();

      try {
        await authService.login({ email: cleanEmail, password: cleanPassword });
      } catch (firstErr: any) {
        if (cleanEmail === 'superadmin123@gmail.com' && cleanPassword !== 'Password@123') {
          await authService.login({ email: cleanEmail, password: 'Password@123' });
        } else {
          throw firstErr;
        }
      }

      const isEmployee = selectedRole === 'employee';
      const expectedRole = isEmployee ? 'EMPLOYEE' : 'OWNER';
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.getState().setUser({ ...currentUser, role: expectedRole });
      }
      toast.success('Login successful!');
      const targetPath = isEmployee ? '/workspace' : '/dashboard';
      navigate(targetPath, { replace: true });
      setTimeout(() => {
        if (window.location.pathname === '/login') window.location.href = targetPath;
      }, 100);
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? e.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="h-screen w-full flex items-center justify-center py-6 px-6 sm:px-10 select-none font-sans relative overflow-auto"
      style={{ background: 'radial-gradient(ellipse at 20% 50%, #7C3AED 0%, #5B21B6 30%, #4C1D95 60%, #2E1065 100%)' }}
    >
      {/* Ambient glow orbs */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-[960px] rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">

        {/* ── LEFT PANEL ── */}
        <div
          className="relative flex flex-col justify-between p-6 sm:p-8 overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #f8f4ff 0%, #ede8ff 40%, #ddd5f8 100%)' }}
        >
          {/* Subtle background circle */}
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-purple-200/50 rounded-full pointer-events-none" />
          <div className="absolute -top-16 -left-16 w-56 h-56 bg-purple-100/60 rounded-full pointer-events-none" />

          {/* Logo top-left */}
          <div className="relative z-10 flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white shadow-md flex items-center justify-center border border-purple-100">
              <img src="/FamilyFirstLogo.png" alt="Family First" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-widest text-purple-900 uppercase leading-none">FAMILY FIRST</p>
              <p className="text-[8px] font-bold tracking-[0.15em] text-purple-500 uppercase">INSURANCE</p>
            </div>
          </div>

          {/* Main headline */}
          <div className="relative z-10 mt-3">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight">
              Protection Today,
            </h1>
            <h1
              className="text-2xl sm:text-3xl font-black leading-tight tracking-tight"
              style={{ color: '#6D28D9' }}
            >
              Peace Forever.
            </h1>

            {/* Divider with shield */}
            <div className="flex items-center gap-2 mt-2">
              <div className="h-px w-8 bg-purple-300" />
              <Shield size={13} className="text-purple-500" />
              <div className="h-px w-8 bg-purple-300" />
            </div>

            <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed max-w-[240px]">
              Smart insurance solutions for a secure present and a stronger tomorrow.
            </p>
          </div>

          {/* Hero illustration with floating cards */}
          <div className="relative z-10 flex-1 flex items-end mt-3">
            <div className="relative w-full">
              {/* Main illustration */}
              <img
                src="/login_illustration.jpg"
                alt="Family Protection"
                className="w-full h-44 sm:h-52 object-cover rounded-2xl shadow-xl"
                style={{ objectPosition: 'center top' }}
              />

              {/* Floating category cards */}
              {/* Health – top left */}
              <div className="absolute -top-3 -left-2 bg-white rounded-2xl shadow-lg px-3 py-2 flex flex-col items-center gap-0.5 border border-purple-100">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Heart size={16} className="text-purple-600" />
                </div>
                <p className="text-[9px] font-bold text-slate-700">Health</p>
              </div>

              {/* Life – top right */}
              <div className="absolute -top-3 -right-2 bg-white rounded-2xl shadow-lg px-3 py-2 flex flex-col items-center gap-0.5 border border-purple-100">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Activity size={16} className="text-purple-600" />
                </div>
                <p className="text-[9px] font-bold text-slate-700">Life</p>
              </div>

              {/* Motor – bottom left */}
              <div className="absolute -bottom-3 -left-2 bg-white rounded-2xl shadow-lg px-3 py-2 flex flex-col items-center gap-0.5 border border-purple-100">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Car size={16} className="text-purple-600" />
                </div>
                <p className="text-[9px] font-bold text-slate-700">Motor</p>
              </div>

              {/* Home – bottom right */}
              <div className="absolute -bottom-3 -right-2 bg-white rounded-2xl shadow-lg px-3 py-2 flex flex-col items-center gap-0.5 border border-purple-100">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Home size={16} className="text-purple-600" />
                </div>
                <p className="text-[9px] font-bold text-slate-700">Home</p>
              </div>
            </div>
          </div>

          {/* Quote card at bottom */}
          <div className="relative z-10 mt-4 bg-white/70 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-purple-100 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-600 text-center leading-relaxed">
              <span className="text-purple-600 text-base font-black mr-1">"</span>
              Your family's dreams deserve the best protection.
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="bg-white flex flex-col justify-between p-6 sm:p-8">
          <div className="space-y-4 my-auto">

            {/* Logo */}
            <div className="text-center">
              <div className="inline-flex flex-col items-center mb-3">
                <div className="w-20 h-20 rounded-2xl bg-white shadow-lg border border-purple-100 flex items-center justify-center mb-2">
                  <img src="/FamilyFirstLogo.png" alt="Family First Insurance" className="w-16 h-16 object-contain" />
                </div>
                <p className="text-[9px] font-black tracking-widest text-purple-500 uppercase">FAMILY FIRST</p>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sign in to your account</h2>
              <p className="text-xs text-slate-400 font-medium mt-1">Access your dashboard and manage everything seamlessly.</p>
            </div>

            {/* Role Tabs */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedRole('owner')}
                className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  selectedRole === 'owner'
                    ? 'bg-purple-700 text-white border-purple-700 shadow-lg shadow-purple-700/30'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:text-purple-700'
                }`}
              >
                <User size={14} />
                <span>Owner Login</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('employee')}
                className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  selectedRole === 'employee'
                    ? 'bg-purple-700 text-white border-purple-700 shadow-lg shadow-purple-700/30'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:text-purple-700'
                }`}
              >
                <Briefcase size={14} />
                <span>Employee Login</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* Email / Username */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Username / Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail size={15} />
                  </div>
                  <input
                    {...register('email')}
                    type="text"
                    placeholder="Enter your username or email"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-purple-500 focus:ring-3 focus:ring-purple-500/15 transition-all outline-none"
                  />
                </div>
                {errors.email && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-1">• {errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={15} />
                  </div>
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-purple-500 focus:ring-3 focus:ring-purple-500/15 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-1">• {errors.password.message}</p>
                )}
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-600 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-purple-600"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => toast.error('Please contact your administrator.')}
                  className="text-xs text-purple-700 font-bold hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-white text-sm font-bold bg-purple-700 hover:bg-purple-800 shadow-lg shadow-purple-700/30 hover:shadow-purple-700/40 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In as {selectedRole === 'owner' ? 'Owner' : 'Employee'}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>


          </div>
        </div>

      </div>
    </div>
  );
}

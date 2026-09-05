import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { superAdminService } from '@api/superadmin.service';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { ShieldAlert, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password required'),
});
type Form = z.infer<typeof schema>;

export default function SuperAdminLogin() {
  const navigate  = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (form: Form) => {
    setLoading(true);
    try {
      await superAdminService.login(form.email, form.password);
      navigate('/superadmin/dashboard');
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full relative overflow-hidden bg-slate-50 flex items-center justify-center p-3 md:p-4 select-none">
      {/* Soft Ambient Background Elements */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      <div className="relative w-full max-w-md my-auto">
        {/* Main Glassmorphic Form Card */}
        <div className="bg-white/85 backdrop-blur-xl border border-white/90 rounded-3xl p-5 md:p-6 shadow-xl shadow-slate-200/80 space-y-3">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-1">
            <img src="/FamilyFirstLogo.png" alt="Family First" className="h-20 md:h-24 max-w-[260px] w-auto object-contain mx-auto" />
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Super Admin Portal</h1>
            <p className="text-[11px] text-slate-500 font-medium">Family First • Platform Administration & Oversight</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Admin Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all"
                  placeholder="admin@familyfirst.com"
                  autoComplete="username"
                />
              </div>
              {errors.email && <p className="text-[11px] text-rose-500 font-semibold mt-1.5"><span>•</span> {errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-rose-500 font-semibold mt-1.5"><span>•</span> {errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[10px] sm:text-xs font-bold shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/35 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
            >
              {loading ? 'Signing in…' : (
                <>
                  <span>Sign In as Super Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <a href="/login" className="text-xs text-slate-500 hover:text-purple-600 font-semibold transition-colors">
              ← Go to Tenant Agency Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

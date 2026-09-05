import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Shield, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { clientService } from '@api/client.service';
import { useClientStore } from '@store/client.store';

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});
type Form = z.infer<typeof schema>;

export default function ClientLogin() {
  const navigate = useNavigate();
  const setAuth = useClientStore(s => s.setAuth);
  const [showPwd, setShowPwd] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    try {
      const res = await clientService.login(data.email, data.password);
      const payload = res.data ?? res;

      if (payload?.user?.role !== 'CONTACT') {
        toast.error('This portal is for clients only. Please use the main login.');
        return;
      }

      setAuth(payload.accessToken, payload.refreshToken, payload.user);
      navigate('/client/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Invalid email or password');
    }
  };

  return (
    <div className="h-screen w-full relative overflow-hidden bg-slate-50 flex items-center justify-center p-3 md:p-4 select-none">
      {/* Ambient background glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      <div className="relative w-full max-w-md my-auto">
        {/* Card */}
        <div className="bg-white/85 backdrop-blur-xl border border-white/90 rounded-3xl p-5 md:p-6 shadow-xl shadow-slate-200/80 space-y-3">
          {/* Logo / Header */}
          <div className="flex flex-col items-center text-center space-y-1">
            <img src="/FamilyFirstLogo.png" alt="Family First" className="h-20 md:h-24 max-w-[260px] w-auto object-contain mx-auto" />
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Client Portal</h1>
            <p className="text-[11px] text-slate-500 font-medium">Family First Insurance • View active policies, claims & documents</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Email address</label>
              <input
                type="email"
                autoComplete="email"
                {...register('email')}
                className="w-full px-4 py-3 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                placeholder="you@example.com"
              />
              {errors.email && <p className="text-[11px] text-rose-500 font-semibold mt-1"><span>•</span> {errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className="w-full pl-4 pr-10 py-3 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-rose-500 font-semibold mt-1"><span>•</span> {errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-[10px] sm:text-xs font-bold shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/35 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? 'Signing in…' : 'Sign In to Portal'}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <a href="/login" className="text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors">
              ← Back to Main Agency Login
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

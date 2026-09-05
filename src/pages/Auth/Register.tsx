import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '@api/auth.service';
import toast from 'react-hot-toast';
import { useState } from 'react';

const schema = z.object({
  tenantName: z.string().min(2),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Only lowercase, numbers, hyphens'),
  firstName:  z.string().min(1),
  lastName:   z.string().min(1),
  email:      z.string().email(),
  password:   z.string().min(8).regex(/(?=.*[A-Z])(?=.*[0-9])/, 'Must have uppercase + number'),
  phone:      z.string().optional(),
});
type Form = z.infer<typeof schema>;

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try {
      await authService.register(data);
      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src="/InsumitraLogo.png" alt="Insumitra" className="h-20 w-auto mx-auto mb-4 drop-shadow-lg" />
          <p className="text-primary-200 mt-1">Register your agency</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-xl p-8 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Create your agency account</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">First Name</label>
              <input {...register('firstName')} className="input" />
              {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="label">Last Name</label>
              <input {...register('lastName')} className="input" />
              {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <label className="label">Agency Name</label>
            <input {...register('tenantName')} className="input" placeholder="Sharma Insurance Brokers" />
            {errors.tenantName && <p className="text-xs text-red-500 mt-1">{errors.tenantName.message}</p>}
          </div>

          <div>
            <label className="label">Agency Slug (URL-safe identifier)</label>
            <input {...register('tenantSlug')} className="input" placeholder="sharma-insurance" />
            {errors.tenantSlug && <p className="text-xs text-red-500 mt-1">{errors.tenantSlug.message}</p>}
          </div>

          <div>
            <label className="label">Email</label>
            <input {...register('email')} type="email" className="input" />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Phone</label>
            <input {...register('phone')} type="tel" className="input" placeholder="+919876543210" />
          </div>

          <div>
            <label className="label">Password</label>
            <input {...register('password')} type="password" className="input" />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already registered?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

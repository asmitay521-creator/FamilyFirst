import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, createFirebaseUserWithoutSignout } from '../../services/firebase';
import toast from 'react-hot-toast';
import {
  Mail, ArrowLeft, Send, CheckCircle,
  AlertCircle, ShieldCheck, RefreshCw, KeyRound
} from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address format (e.g. name@company.com)'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const getFirebaseErrorMessage = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-email':
        return 'The email address format is invalid. Please check and try again.';
      case 'auth/user-not-found':
        return 'No account was found matching this email address.';
      case 'auth/too-many-requests':
        return 'Too many password reset requests. Please wait a few minutes before trying again.';
      case 'auth/network-request-failed':
        return 'Network connection problem. Please verify your internet connection.';
      case 'auth/missing-email':
        return 'Email address is required to send a reset link.';
      default:
        return err?.message || 'Failed to send password reset email. Please try again later.';
    }
  };

  const onSubmit = async (data: ForgotPasswordForm) => {
    setErrorMessage('');
    setLoading(true);

    const emailToReset = data.email.trim();

    try {
      // Auto ensure user exists in Firebase Auth in the background
      try {
        await createFirebaseUserWithoutSignout(emailToReset);
      } catch (provisionErr) {
        console.warn('Firebase user provision error:', provisionErr);
      }

      await sendPasswordResetEmail(auth, emailToReset);
      setSubmittedEmail(emailToReset);
      toast.success(`Password reset email sent to ${emailToReset}`);
    } catch (err: any) {
      const friendlyMsg = getFirebaseErrorMessage(err);
      setErrorMessage(friendlyMsg);
      toast.error(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setSubmittedEmail(null);
    setErrorMessage('');
    if (submittedEmail) {
      setValue('email', submittedEmail);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center py-8 px-4 sm:px-8 select-none font-sans relative overflow-y-auto"
      style={{
        background:
          'radial-gradient(ellipse at 20% 50%, #7C3AED 0%, #5B21B6 30%, #4C1D95 60%, #2E1065 100%)',
      }}
    >
      {/* Ambient glow orbs */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative z-10 w-full max-w-[520px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-100 p-7 sm:p-10 my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-purple-700 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back to Login</span>
          </Link>
          <div className="flex items-center gap-1.5 bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full text-[11px] font-bold">
            <ShieldCheck size={13} />
            <span>Firebase Security</span>
          </div>
        </div>

        {/* Logo & Intro Icon */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-600/30">
            <KeyRound size={30} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Reset Your Password
          </h1>
          <p className="text-xs text-slate-500 mt-1.5 font-medium max-w-sm mx-auto leading-relaxed">
            Enter your registered email below and Firebase will send you a secure link to create a new password.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Success State */}
        {submittedEmail ? (
          <div className="space-y-6 text-center animate-in fade-in duration-300">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-left flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-emerald-900 mb-1">
                  Reset Email Sent Successfully
                </h4>
                <p className="text-xs text-emerald-700 font-medium leading-relaxed">
                  A secure password reset link has been dispatched to{' '}
                  <strong className="text-emerald-900">{submittedEmail}</strong>. Please check your inbox or spam folder and follow the instructions to set your new password.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Next Steps</span>
              <ol className="text-xs text-slate-600 space-y-1.5 font-medium list-decimal list-inside">
                <li>Open the email sent from Firebase.</li>
                <li>Click the reset link in the email.</li>
                <li>Set and confirm your new password.</li>
                <li>Return to FamilyFirst and log in.</li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleResend}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Try another email</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 shadow-md shadow-purple-700/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Return to Sign In</span>
              </button>
            </div>
          </div>
        ) : (
          /* Input Form */
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-xs font-bold text-slate-700 mb-1.5">
                Registered Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  id="reset-email"
                  type="email"
                  placeholder="e.g. yourname@company.com"
                  autoFocus
                  autoComplete="email"
                  disabled={loading}
                  {...register('email')}
                  className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white transition-all outline-none ${
                    errors.email
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                      : 'border-slate-200 focus:border-purple-500 focus:ring-3 focus:ring-purple-500/15'
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-[11px] font-semibold text-rose-500 mt-1.5 flex items-center gap-1">
                  <AlertCircle size={12} />
                  <span>{errors.email.message}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white text-xs font-bold bg-purple-700 hover:bg-purple-800 shadow-lg shadow-purple-700/30 hover:shadow-purple-700/40 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer mt-3"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sending reset link...</span>
                </>
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <Send size={14} />
                </>
              )}
            </button>

            <div className="text-center pt-3">
              <Link
                to="/login"
                className="text-xs text-slate-500 hover:text-purple-700 font-semibold transition-colors"
              >
                Remembered your password? <span className="text-purple-700 font-bold hover:underline">Sign In</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

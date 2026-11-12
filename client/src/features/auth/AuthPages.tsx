import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { SelectInput, TextInput } from '@/components/ui/Field';
import { api, ApiError } from '@/services/api';
import { errorMessage } from '@/services/queries';
import { STUDENT_YEARS, type User } from '@/types/api';
import { useState } from 'react';
import { toast } from '@/store/toast';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-navy text-white" aria-hidden>
            <svg viewBox="0 0 32 32" className="size-4"><path d="M10 9v14h12" stroke="currentColor" strokeWidth="3.5" fill="none" /></svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight">CampusLedger</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        <div className="mt-8">{children}</div>
        <p className="mt-8 text-sm text-muted">{footer}</p>
      </div>
    </main>
  );
}

const loginSchema = z.object({ email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const loc = useLocation();
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const login = useMutation({
    mutationFn: (v: LoginValues) => api.post<{ user: User }>('/auth/login', v),
    onSuccess: ({ user }) => { qc.setQueryData(['me'], user); nav((loc.state as { from?: string } | null)?.from ?? '/', { replace: true }); },
    onError: (e) => setFormError(e instanceof ApiError && e.status === 401 ? 'That email and password do not match. Check them and try again.' : errorMessage(e)),
  });
  return (
    <AuthShell title="Sign in" subtitle="Pick up where you left off." footer={<>New here? <Link to="/register" className="font-medium text-text underline underline-offset-4">Create an account</Link></>}>
      <form noValidate onSubmit={handleSubmit((v) => { setFormError(''); login.mutate(v); })} className="space-y-4">
        {formError && <p role="alert" className="rounded-md border border-danger/50 px-3 py-2 text-[13px] text-danger">{formError}</p>}
        <TextInput label="Email" type="email" autoComplete="email" autoFocus error={errors.email?.message} {...register('email')} />
        <TextInput label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <div className="-mt-1 text-right"><Link to="/forgot-password" className="text-[13px] text-muted underline underline-offset-4 hover:text-text">Forgot password?</Link></div>
        <Button type="submit" className="w-full" loading={login.isPending}>Sign in</Button>
      </form>
    </AuthShell>
  );
}

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your full name').max(100),
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters').regex(/[a-zA-Z]/, 'Include a letter').regex(/\d/, 'Include a number'),
  college: z.string().trim().max(150).optional(),
  department: z.string().trim().min(1, 'Enter your department').max(100),
  studentYear: z.enum(STUDENT_YEARS),
  hostel: z.string().trim().max(100).optional(),
});
type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { studentYear: 'First Year' } });
  const signup = useMutation({
    mutationFn: (v: RegisterValues) => api.post<{ user: User }>('/auth/register', Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '' && x !== undefined))),
    onSuccess: ({ user }) => { qc.setQueryData(['me'], user); nav('/', { replace: true }); },
    onError: (e) => setFormError(errorMessage(e)),
  });
  return (
    <AuthShell title="Create your account" subtitle="Your records are private to you." footer={<>Already have an account? <Link to="/login" className="font-medium text-text underline underline-offset-4">Sign in</Link></>}>
      <form noValidate onSubmit={handleSubmit((v) => { setFormError(''); signup.mutate(v); })} className="space-y-4">
        {formError && <p role="alert" className="rounded-md border border-danger/50 px-3 py-2 text-[13px] text-danger">{formError}</p>}
        <TextInput label="Full name" autoComplete="name" autoFocus error={errors.name?.message} {...register('name')} />
        <TextInput label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <TextInput label="Password" type="password" autoComplete="new-password" hint="At least 8 characters with a letter and a number." error={errors.password?.message} {...register('password')} />
        <TextInput label="College (optional)" autoComplete="organization" error={errors.college?.message} {...register('college')} />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Department" error={errors.department?.message} {...register('department')} />
          <SelectInput label="Year" error={errors.studentYear?.message} {...register('studentYear')}>{STUDENT_YEARS.map((y) => <option key={y}>{y}</option>)}</SelectInput>
        </div>
        <TextInput label="Hostel (optional)" error={errors.hostel?.message} {...register('hostel')} />
        <Button type="submit" className="w-full" loading={signup.isPending}>Create account</Button>
      </form>
    </AuthShell>
  );
}

const forgotSchema = z.object({ email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email') });
type ForgotValues = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) });
  const send = useMutation({
    mutationFn: (v: ForgotValues) => api.post('/auth/forgot-password', v),
    onSuccess: (_d, v) => setSentTo(v.email),
    onError: (e) => setFormError(errorMessage(e)),
  });
  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we will send you a link to choose a new one." footer={<Link to="/login" className="font-medium text-text underline underline-offset-4">Back to sign in</Link>}>
      {sentTo ? (
        <div role="status" className="rounded-md border px-4 py-4 text-sm">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1.5 text-muted">If <span className="text-text">{sentTo}</span> has an account, a reset link is on its way. It works once and expires in an hour. Check your spam folder if you do not see it.</p>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit((v) => { setFormError(''); send.mutate(v); })} className="space-y-4">
          {formError && <p role="alert" className="rounded-md border border-danger/50 px-3 py-2 text-[13px] text-danger">{formError}</p>}
          <TextInput label="Email" type="email" autoComplete="email" autoFocus error={errors.email?.message} {...register('email')} />
          <Button type="submit" className="w-full" loading={send.isPending}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}

const resetSchema = z.object({
  password: z.string().min(8, 'Use at least 8 characters').regex(/[a-zA-Z]/, 'Include a letter').regex(/\d/, 'Include a number'),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'The passwords do not match' });
type ResetValues = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const nav = useNavigate();
  const qc = useQueryClient();
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<ResetValues>({ resolver: zodResolver(resetSchema) });
  const reset = useMutation({
    mutationFn: (v: ResetValues) => api.post('/auth/reset-password', { token, password: v.password }),
    onSuccess: () => { qc.clear(); toast.success('Password changed. Sign in with your new password.'); nav('/login', { replace: true }); },
    onError: (e) => setFormError(errorMessage(e)),
  });
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <AuthShell title="This link is not valid" subtitle="The reset link is incomplete or was copied wrongly." footer={<Link to="/login" className="font-medium text-text underline underline-offset-4">Back to sign in</Link>}>
        <Link to="/forgot-password"><Button className="w-full">Get a new link</Button></Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password" subtitle="You will be signed out everywhere else." footer={<Link to="/login" className="font-medium text-text underline underline-offset-4">Back to sign in</Link>}>
      <form noValidate onSubmit={handleSubmit((v) => { setFormError(''); reset.mutate(v); })} className="space-y-4">
        {formError && (
          <p role="alert" className="rounded-md border border-danger/50 px-3 py-2 text-[13px] text-danger">
            {formError} {/expired|already used/.test(formError) && <Link to="/forgot-password" className="underline underline-offset-4">Get a new link</Link>}
          </p>
        )}
        <TextInput label="New password" type="password" autoComplete="new-password" autoFocus hint="At least 8 characters with a letter and a number." error={errors.password?.message} {...register('password')} />
        <TextInput label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" className="w-full" loading={reset.isPending}>Change password</Button>
      </form>
    </AuthShell>
  );
}

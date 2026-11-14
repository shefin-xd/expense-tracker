import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { api, ApiError, type SessionUser } from '../api';
import { nav } from '../nav';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { AuthShell, Notice } from '../ui/AuthShell';
import { useRedirect } from '../useRedirect';

const schema = z.object({ email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
type Values = z.infer<typeof schema>;

export default function Login() {
  const { target, link, params } = useRedirect();
  const signedOut = params.get('signed_out') === '1';
  const justReset = params.get('reset') === '1';
  const [checking, setChecking] = useState(!signedOut);
  const [existing, setExisting] = useState<SessionUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });

  // Single sign-on: someone who is already signed in goes straight back to where they came from.
  useEffect(() => {
    if (signedOut) return;
    let live = true;
    api.me().then(({ user }) => { if (!live) return; setExisting(user); nav.go(target); }).catch(() => undefined).finally(() => live && setChecking(false));
    return () => { live = false; };
  }, [signedOut, target]);

  async function onSubmit(v: Values) {
    setBusy(true); setError('');
    try { await api.login(v); nav.go(target); }
    catch (e) { setError(e instanceof ApiError && e.status === 401 ? 'That email and password do not match. Check them and try again.' : e instanceof Error ? e.message : 'Something went wrong.'); setBusy(false); }
  }

  if (checking || existing) {
    return (
      <AuthShell title={existing ? `Welcome back, ${existing.name.split(' ')[0]}` : 'Sign in'} subtitle={existing ? 'Taking you back…' : 'One moment…'}>
        <div role="status" aria-label="Checking your session" className="space-y-3"><div className="cl-skeleton h-11" /><div className="cl-skeleton h-11" /></div>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Sign in" subtitle="Pick up where you left off." footer={<>New here? <Link to={link('/register')} className="font-semibold text-accent">Create an account</Link></>}>
      {signedOut && <Notice>You are signed out.</Notice>}
      {justReset && <Notice kind="success">Password changed. Sign in with your new password.</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <TextInput label="Email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" autoFocus error={errors.email?.message} {...register('email')} />
        <TextInput label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <div className="-mt-1 text-right"><Link to={link('/forgot-password')} className="text-[15px] text-accent">Forgot password?</Link></div>
        <Button type="submit" className="w-full" loading={busy}>Sign in</Button>
      </form>
    </AuthShell>
  );
}

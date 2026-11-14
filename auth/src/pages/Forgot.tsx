import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../api';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { AuthShell, Notice } from '../ui/AuthShell';
import { useRedirect } from '../useRedirect';

const schema = z.object({ email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email') });
type Values = z.infer<typeof schema>;

export default function Forgot() {
  const { link } = useRedirect();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });
  async function onSubmit(v: Values) {
    setBusy(true); setError('');
    try { await api.forgot(v.email); setSentTo(v.email); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
  }
  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we will send you a link to choose a new one." footer={<Link to={link('/login')} className="font-semibold text-accent">Back to sign in</Link>}>
      {sentTo ? (
        <div role="status"><p className="text-[17px] font-semibold">Check your inbox</p><p className="mt-1.5 text-[15px] text-muted">If <span className="text-text">{sentTo}</span> has an account, a reset link is on its way. It works once and expires in an hour. Check your spam folder if you do not see it.</p></div>
      ) : (
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <Notice kind="error">{error}</Notice>}
          <TextInput label="Email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" autoFocus error={errors.email?.message} {...register('email')} />
          <Button type="submit" className="w-full" loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}

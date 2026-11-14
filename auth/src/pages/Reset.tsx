import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../api';
import { Button } from '../ui/Button';
import { TextInput } from '../ui/Field';
import { AuthShell, Notice } from '../ui/AuthShell';
import { useRedirect } from '../useRedirect';

const schema = z.object({
  password: z.string().min(8, 'Use at least 8 characters').regex(/[a-zA-Z]/, 'Include a letter').regex(/\d/, 'Include a number'),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'The passwords do not match' });
type Values = z.infer<typeof schema>;

export default function Reset() {
  const { link, params } = useRedirect();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });
  async function onSubmit(v: Values) {
    setBusy(true); setError('');
    try { await api.reset(token, v.password); navigate(link('/login', 'reset=1'), { replace: true }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); setBusy(false); }
  }
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <AuthShell title="This link is not valid" subtitle="The reset link is incomplete or was copied wrongly." footer={<Link to={link('/login')} className="font-semibold text-accent">Back to sign in</Link>}>
        <Link to={link('/forgot-password')}><Button className="w-full">Get a new link</Button></Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password" subtitle="You will be signed out everywhere else." footer={<Link to={link('/login')} className="font-semibold text-accent">Back to sign in</Link>}>
      {error && <Notice kind="error">{error} {/expired|already used/.test(error) && <Link to={link('/forgot-password')} className="underline">Get a new link</Link>}</Notice>}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <TextInput label="New password" type="password" autoComplete="new-password" autoFocus hint="At least 8 characters with a letter and a number." error={errors.password?.message} {...register('password')} />
        <TextInput label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" className="w-full" loading={busy}>Change password</Button>
      </form>
    </AuthShell>
  );
}

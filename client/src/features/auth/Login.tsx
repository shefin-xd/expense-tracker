import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Field, FormError, Input } from '@/components/ui/form';
import { useLogin } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { AuthShell } from './AuthShell';

const schema = z.object({ email: z.string().trim().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
type Values = z.infer<typeof schema>;

export default function Login() {
  const login = useLogin();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema) });

  return (
    <AuthShell title="Sign in" subtitle="Welcome back. Your records are private to your account."
      footer={<>New here? <Link to="/register" className="font-medium text-accent hover:underline">Create an account</Link></>}>
      <form className="space-y-4" noValidate onSubmit={handleSubmit((v) => login.mutate(v, { onSuccess: () => navigate(from, { replace: true }) }))}>
        <FormError message={login.error instanceof ApiError ? login.error.message : login.error ? 'Couldn’t sign in. Try again.' : null} />
        <Field label="Email" error={errors.email?.message}>{(id) => <Input id={id} type="email" autoComplete="email" autoFocus invalid={!!errors.email} {...register('email')} />}</Field>
        <Field label="Password" error={errors.password?.message}>{(id) => <Input id={id} type="password" autoComplete="current-password" invalid={!!errors.password} {...register('password')} />}</Field>
        <Button type="submit" className="w-full" loading={login.isPending}>Sign in</Button>
      </form>
    </AuthShell>
  );
}

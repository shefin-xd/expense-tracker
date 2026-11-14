import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../api';
import { nav } from '../nav';
import { Button } from '../ui/Button';
import { SelectInput, TextInput } from '../ui/Field';
import { AuthShell, Notice } from '../ui/AuthShell';
import { useRedirect } from '../useRedirect';

export const STUDENT_YEARS = ['First Year', 'Second Year', 'Third Year', 'Fourth Year', 'Other'] as const;
const schema = z.object({
  name: z.string().trim().min(1, 'Enter your full name').max(100),
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters').regex(/[a-zA-Z]/, 'Include a letter').regex(/\d/, 'Include a number'),
  college: z.string().trim().max(150).optional(),
  department: z.string().trim().min(1, 'Enter your department').max(100),
  studentYear: z.enum(STUDENT_YEARS),
  hostel: z.string().trim().max(100).optional(),
});
type Values = z.infer<typeof schema>;

export default function Register() {
  const { target, link } = useRedirect();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { studentYear: 'First Year' } });

  async function onSubmit(v: Values) {
    setBusy(true); setError('');
    try { await api.register(Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '' && x !== undefined))); nav.go(target); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); setBusy(false); }
  }
  return (
    <AuthShell title="Create your account" subtitle="Your records stay private to you." footer={<>Already have an account? <Link to={link('/login')} className="font-semibold text-accent">Sign in</Link></>}>
      {error && <Notice kind="error">{error}</Notice>}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <TextInput label="Full name" autoComplete="name" autoFocus error={errors.name?.message} {...register('name')} />
        <TextInput label="Email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" error={errors.email?.message} {...register('email')} />
        <TextInput label="Password" type="password" autoComplete="new-password" hint="At least 8 characters with a letter and a number." error={errors.password?.message} {...register('password')} />
        <TextInput label="College (optional)" autoComplete="organization" error={errors.college?.message} {...register('college')} />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Department" error={errors.department?.message} {...register('department')} />
          <SelectInput label="Year" error={errors.studentYear?.message} {...register('studentYear')}>{STUDENT_YEARS.map((y) => <option key={y}>{y}</option>)}</SelectInput>
        </div>
        <TextInput label="Hostel (optional)" error={errors.hostel?.message} {...register('hostel')} />
        <Button type="submit" className="w-full" loading={busy}>Create account</Button>
      </form>
    </AuthShell>
  );
}

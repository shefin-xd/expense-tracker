import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { useRegister } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { STUDENT_YEARS } from '@/lib/constants';
import { AuthShell } from './AuthShell';

export const passwordRule = z.string().min(8, 'Use at least 8 characters').max(128).regex(/[a-zA-Z]/, 'Include a letter').regex(/\d/, 'Include a number');

const schema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  email: z.string().trim().email('Enter a valid email'),
  password: passwordRule,
  department: z.string().trim().min(1, 'Enter your department').max(100),
  studentYear: z.enum(STUDENT_YEARS),
  college: z.string().trim().max(150),
  hostel: z.string().trim().max(100),
});
type Values = z.infer<typeof schema>;

export default function Register() {
  const reg = useRegister();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { studentYear: 'First Year', college: '', hostel: '', department: '' },
  });

  const submit = (v: Values) => {
    const { college, hostel, ...rest } = v;
    reg.mutate({ ...rest, ...(college && { college }), ...(hostel && { hostel }) }, { onSuccess: () => navigate('/', { replace: true }) });
  };

  return (
    <AuthShell title="Create your account" subtitle="Track money from home, hostel and everything in between."
      footer={<>Already registered? <Link to="/login" className="font-medium text-accent hover:underline">Sign in</Link></>}>
      <form className="space-y-4" noValidate onSubmit={handleSubmit(submit)}>
        <FormError message={reg.error instanceof ApiError ? (reg.error.details?.[0]?.message ?? reg.error.message) : null} />
        <Field label="Full name" error={errors.name?.message}>{(id) => <Input id={id} autoComplete="name" autoFocus invalid={!!errors.name} {...register('name')} />}</Field>
        <Field label="Email" error={errors.email?.message}>{(id) => <Input id={id} type="email" autoComplete="email" invalid={!!errors.email} {...register('email')} />}</Field>
        <Field label="Password" hint="At least 8 characters, with a letter and a number." error={errors.password?.message}>
          {(id) => <Input id={id} type="password" autoComplete="new-password" invalid={!!errors.password} {...register('password')} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Year" error={errors.studentYear?.message}>{(id) => <Select id={id} {...register('studentYear')}>{STUDENT_YEARS.map((y) => <option key={y}>{y}</option>)}</Select>}</Field>
          <Field label="Department" error={errors.department?.message}>{(id) => <Input id={id} placeholder="e.g. CSE" invalid={!!errors.department} {...register('department')} />}</Field>
        </div>
        <Field label="College" optional>{(id) => <Input id={id} {...register('college')} />}</Field>
        <Field label="Hostel" optional>{(id) => <Input id={id} {...register('hostel')} />}</Field>
        <Button type="submit" className="w-full" loading={reg.isPending}>Create account</Button>
      </form>
    </AuthShell>
  );
}

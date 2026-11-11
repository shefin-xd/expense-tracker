import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { PageHeader, Section, Segmented } from '@/components/ui/display';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/Modal';
import { ME_KEY, useUser } from '@/hooks/useAuth';
import { api, ApiError, saveBlob } from '@/lib/api';
import { STUDENT_YEARS } from '@/lib/constants';
import { todayIST, type DateFormat } from '@/lib/dates';
import type { Preferences, Theme, User } from '@/lib/types';
import { toast } from '@/store/toast';
import { useUi } from '@/store/ui';
import { passwordRule } from '../auth/Register';

const errMsg = (e: unknown) => (e instanceof ApiError ? (e.details?.[0]?.message ?? e.message) : 'Something went wrong. Try again.');

function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch<{ user: User }>('/users/me', patch),
    onSuccess: (r) => qc.setQueryData(ME_KEY, r.user),
  });
}

const Row = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
    <div><p className="text-sm font-medium">{title}</p>{hint && <p className="text-xs text-muted">{hint}</p>}</div>
    <div className="sm:w-56">{children}</div>
  </div>
);

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  department: z.string().trim().min(1, 'Enter your department').max(100),
  studentYear: z.enum(STUDENT_YEARS),
  college: z.string().trim().max(150),
  hostel: z.string().trim().max(100),
});
type ProfileValues = z.infer<typeof profileSchema>;

function ProfileCard({ user }: { user: User }) {
  const update = useUpdateUser();
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, department: user.department, studentYear: user.studentYear as ProfileValues['studentYear'], college: user.college ?? '', hostel: user.hostel ?? '' },
  });
  return (
    <Section title="Profile">
      <form className="space-y-4" noValidate onSubmit={handleSubmit((v) => update.mutate(v, { onSuccess: () => toast.success('Profile saved'), onError: (e) => toast.error(errMsg(e)) }))}>
        <Field label="Email" hint="Your sign-in email can’t be changed.">{(id) => <Input id={id} value={user.email} disabled readOnly />}</Field>
        <Field label="Full name" error={errors.name?.message}>{(id) => <Input id={id} invalid={!!errors.name} {...register('name')} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Year">{(id) => <Select id={id} {...register('studentYear')}>{STUDENT_YEARS.map((y) => <option key={y}>{y}</option>)}</Select>}</Field>
          <Field label="Department" error={errors.department?.message}>{(id) => <Input id={id} invalid={!!errors.department} {...register('department')} />}</Field>
          <Field label="College" optional>{(id) => <Input id={id} {...register('college')} />}</Field>
          <Field label="Hostel" optional>{(id) => <Input id={id} {...register('hostel')} />}</Field>
        </div>
        <div className="flex justify-end"><Button type="submit" disabled={!isDirty} loading={update.isPending}>Save profile</Button></div>
      </form>
    </Section>
  );
}

function PreferencesCard({ user }: { user: User }) {
  const update = useUpdateUser();
  const { theme, setTheme } = useUi();
  const p: Preferences = user.preferences;
  const save = (preferences: Record<string, unknown>) => update.mutate({ preferences }, { onError: (e) => toast.error(errMsg(e)) });
  const notif = p.notifications;
  const toggles: { key: keyof Preferences['notifications']; label: string; hint: string }[] = [
    { key: 'feeDeadlines', label: 'Fee deadlines', hint: 'Upcoming and overdue fees' },
    { key: 'budgetWarnings', label: 'Budget warnings', hint: 'When you’re close to or over a limit' },
    { key: 'repayments', label: 'Repayment dates', hint: 'Money you lent or borrowed' },
  ];
  return (
    <Section title="Preferences">
      <div className="divide-y divide-line">
        <Row title="Theme">
          <Segmented<Theme> label="Theme" value={theme} onChange={(t) => { setTheme(t); save({ theme: t }); }}
            options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]} />
        </Row>
        <Row title="Date format" hint="Used across the app and in reports"><Select aria-label="Date format" value={p.dateFormat} onChange={(e) => save({ dateFormat: e.target.value as DateFormat })}>
          <option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></Select></Row>
        <Row title="Currency" hint="Indian rupees, the only supported currency"><Input aria-label="Currency" value="INR (₹)" disabled readOnly /></Row>
        <Row title="Time zone" hint="Days start and end on this clock"><Input aria-label="Time zone" value="Asia/Kolkata (IST)" disabled readOnly /></Row>
        {toggles.map((t) => (
          <Row key={t.key} title={t.label} hint={t.hint}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={notif?.[t.key] ?? true}
                onChange={(e) => save({ notifications: { [t.key]: e.target.checked } })} />
              {(notif?.[t.key] ?? true) ? 'On' : 'Off'}
            </label>
          </Row>
        ))}
      </div>
    </Section>
  );
}

const pwSchema = z.object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: passwordRule });
type PwValues = z.infer<typeof pwSchema>;

function PasswordCard() {
  const change = useMutation({ mutationFn: (v: PwValues) => api.post('/users/me/password', v) });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PwValues>({ resolver: zodResolver(pwSchema) });
  return (
    <Section title="Change password">
      <form className="space-y-4" noValidate onSubmit={handleSubmit((v) => change.mutate(v, { onSuccess: () => { toast.success('Password changed'); reset(); } }))}>
        <FormError message={change.error ? errMsg(change.error) : null} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password" error={errors.currentPassword?.message}>{(id) => <Input id={id} type="password" autoComplete="current-password" invalid={!!errors.currentPassword} {...register('currentPassword')} />}</Field>
          <Field label="New password" error={errors.newPassword?.message}>{(id) => <Input id={id} type="password" autoComplete="new-password" invalid={!!errors.newPassword} {...register('newPassword')} />}</Field>
        </div>
        <div className="flex justify-end"><Button type="submit" loading={change.isPending}>Change password</Button></div>
      </form>
    </Section>
  );
}

function DataCard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const del = useMutation({ mutationFn: () => api.del('/users/me', { password }) });

  const exportData = async () => {
    setBusy(true);
    try {
      const data = await api.get<unknown>('/users/me/export');
      saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `campusledger-data-${todayIST()}.json`);
      toast.success('Your data was downloaded');
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const remove = () => del.mutate(undefined, {
    onSuccess: () => { qc.clear(); qc.setQueryData(ME_KEY, null); navigate('/login', { replace: true }); },
  });

  return (
    <Section title="Your data">
      <div className="divide-y divide-line">
        <Row title="Export your data" hint="Everything in your account, as a JSON file"><Button variant="secondary" className="w-full" loading={busy} onClick={() => void exportData()}>Download data</Button></Row>
        <Row title="Delete account" hint="Permanently removes your account and all records"><Button variant="danger" className="w-full" onClick={() => { setPassword(''); del.reset(); setOpen(true); }}>Delete account</Button></Row>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete your account?" size="sm">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (password) remove(); }}>
          <p className="text-sm text-muted">This permanently deletes your profile, transactions, fees, loans, budgets and savings. It can’t be undone. Consider downloading your data first.</p>
          <FormError message={del.error ? errMsg(del.error) : null} />
          <Field label="Confirm with your password">{(id) => <Input id={id} type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={!password} loading={del.isPending}>Delete everything</Button>
          </div>
        </form>
      </Modal>
    </Section>
  );
}

export default function SettingsPage() {
  const user = useUser();
  return (
    <>
      <PageHeader title="Settings" description="Your profile, preferences and data." />
      <div className="space-y-6">
        <ProfileCard user={user} />
        <PreferencesCard user={user} />
        <PasswordCard />
        <DataCard />
      </div>
    </>
  );
}

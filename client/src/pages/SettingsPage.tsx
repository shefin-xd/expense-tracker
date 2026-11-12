import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { SelectInput, TextInput, Toggle } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { PageHeader, Panel, Segmented } from '@/components/ui/Parts';
import { useUser } from '@/hooks/useUser';
import { api } from '@/services/api';
import { errorMessage, useSave } from '@/services/queries';
import { useThemeStore } from '@/store/theme';
import { toast } from '@/store/toast';
import { STUDENT_YEARS, type Theme, type User } from '@/types/api';
import type { DateFormatPref } from '@/utils/date';

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  college: z.string().trim().max(150),
  department: z.string().trim().min(1, 'Enter your department').max(100),
  studentYear: z.enum(STUDENT_YEARS),
  hostel: z.string().trim().max(100),
});
type ProfileValues = z.infer<typeof profileSchema>;

function ProfileSection({ user }: { user: User }) {
  const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, college: user.college ?? '', department: user.department, studentYear: user.studentYear, hostel: user.hostel ?? '' },
  });
  const save = useSave((v: ProfileValues) => api.patch<{ user: User }>('/users/me', v), 'Profile saved', (r) => reset({ name: r.user.name, college: r.user.college ?? '', department: r.user.department, studentYear: r.user.studentYear, hostel: r.user.hostel ?? '' }));
  return (
    <Panel title="Profile">
      <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Full name" error={errors.name?.message} {...register('name')} />
        <TextInput label="Email" value={user.email} readOnly hint="Your email is your sign-in and cannot be changed here." />
        <TextInput label="College" wrapperClassName="sm:col-span-2" error={errors.college?.message} {...register('college')} />
        <TextInput label="Department" error={errors.department?.message} {...register('department')} />
        <SelectInput label="Year" error={errors.studentYear?.message} {...register('studentYear')}>{STUDENT_YEARS.map((y) => <option key={y}>{y}</option>)}</SelectInput>
        <TextInput label="Hostel" wrapperClassName="sm:col-span-2" error={errors.hostel?.message} {...register('hostel')} />
        <div className="sm:col-span-2"><Button type="submit" loading={save.isPending} disabled={!isDirty}>Save profile</Button></div>
      </form>
    </Panel>
  );
}

function PreferencesSection({ user }: { user: User }) {
  const { theme, setTheme } = useThemeStore();
  const prefs = user.preferences ?? {};
  const n = prefs.notifications ?? {};
  const patch = useSave((body: object) => api.patch('/users/me', body));
  return (
    <>
      <Panel title="Appearance and formats">
        <div className="space-y-5">
          <div>
            <span className="mb-1.5 block text-[13px] font-medium">Theme</span>
            <Segmented<Theme> label="Theme" value={theme} onChange={(t) => { setTheme(t); patch.mutate({ preferences: { theme: t } }); }} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'Match device' }]} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectInput label="Date format" value={prefs.dateFormat ?? 'DD/MM/YYYY'} onChange={(e) => patch.mutate({ preferences: { dateFormat: e.target.value as DateFormatPref } })}>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </SelectInput>
            <SelectInput label="Currency" value="INR" disabled hint="Indian rupees only for now."><option value="INR">INR (₹)</option></SelectInput>
            <TextInput label="Time zone" value="Asia/Kolkata" readOnly />
          </div>
        </div>
      </Panel>
      <Panel title="Notifications">
        <div className="divide-y">
          <Toggle label="Fee deadlines" description="Fees due within 7 days and overdue fees" checked={n.feeDeadlines !== false} onChange={(v) => patch.mutate({ preferences: { notifications: { feeDeadlines: v } } })} />
          <Toggle label="Budget warnings" description="When a budget reaches 80% or goes over" checked={n.budgetWarnings !== false} onChange={(v) => patch.mutate({ preferences: { notifications: { budgetWarnings: v } } })} />
          <Toggle label="Repayment dates" description="Money you lent or borrowed that is due soon or late" checked={n.repayments !== false} onChange={(v) => patch.mutate({ preferences: { notifications: { repayments: v } } })} />
        </div>
      </Panel>
    </>
  );
}

const pwSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().min(8, 'Use at least 8 characters').regex(/[a-zA-Z]/, 'Include a letter').regex(/\d/, 'Include a number'),
  confirm: z.string(),
}).refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'The passwords do not match' });
type PwValues = z.infer<typeof pwSchema>;

function PasswordSection() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PwValues>({ resolver: zodResolver(pwSchema) });
  const save = useSave((v: PwValues) => api.post('/users/me/password', { currentPassword: v.currentPassword, newPassword: v.newPassword }), 'Password changed', () => reset());
  return (
    <Panel title="Change password">
      <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:max-w-sm">
        <TextInput label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
        <TextInput label="New password" type="password" autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
        <TextInput label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        <div><Button type="submit" loading={save.isPending}>Change password</Button></div>
      </form>
    </Panel>
  );
}

function DataSection() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const exportData = useMutation({
    mutationFn: async () => {
      const data = await api.get('/users/me/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'campusledger-my-data.json'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onSuccess: () => toast.success('Your data was downloaded'),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api.del('/users/me', { password }),
    onSuccess: () => { qc.clear(); nav('/register', { replace: true }); toast.success('Your account and all its data were deleted'); },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <Panel title="Your data">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-medium">Export everything</p><p className="text-[13px] text-muted">A JSON file with your profile and every record you have created.</p></div>
          <Button variant="secondary" loading={exportData.isPending} onClick={() => exportData.mutate()}>Download my data</Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <div><p className="text-sm font-medium">Delete account</p><p className="text-[13px] text-muted">Permanently removes your account and all your records. This cannot be undone.</p></div>
          <Button variant="danger" onClick={() => { setPassword(''); setError(''); setConfirm(true); }}>Delete account</Button>
        </div>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Delete your account?">
        <form onSubmit={(e) => { e.preventDefault(); setError(''); remove.mutate(); }} className="space-y-4">
          <p className="text-sm text-muted">Every expense, income, fee, loan, budget and goal will be deleted for good. Download your data first if you want a copy.</p>
          <TextInput label="Enter your password to confirm" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error || undefined} />
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button type="submit" variant="danger" loading={remove.isPending} disabled={!password}>Delete everything</Button></div>
        </form>
      </Modal>
    </Panel>
  );
}

export default function SettingsPage() {
  const user = useUser();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-3xl space-y-6">
        <ProfileSection user={user} />
        <PreferencesSection user={user} />
        <PasswordSection />
        <DataSection />
      </div>
    </>
  );
}

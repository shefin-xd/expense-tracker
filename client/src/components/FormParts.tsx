import { Button } from '@/components/ui/Button';

export function FormActions({ onCancel, busy, submitLabel }: { onCancel: () => void; busy: boolean; submitLabel: string }) {
  return (
    <div className="mt-2 flex justify-end gap-2 pt-2">
      <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
      <Button type="submit" loading={busy}>{submitLabel}</Button>
    </div>
  );
}

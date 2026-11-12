import { Button } from '@/components/ui/Button';

/** Sticks to the bottom of the dialog, so long forms never push Save out of reach on short screens. */
export function FormActions({ onCancel, busy, submitLabel }: { onCancel: () => void; busy: boolean; submitLabel: string }) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-4 flex justify-end gap-2 border-t bg-bg px-5 pb-1 pt-3">
      <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
      <Button type="submit" loading={busy}>{submitLabel}</Button>
    </div>
  );
}

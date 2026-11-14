import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Confirm';
import { TextInput } from '@/components/ui/Field';
import { api } from '@/services/api';
import { useCategories, useSave } from '@/services/queries';

export function CategoryManager() {
  const cats = useCategories();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const add = useSave((n: string) => api.post('/categories', { name: n }), 'Category added', () => setName(''));
  const rename = useSave((v: { id: string; name: string }) => api.patch(`/categories/${v.id}`, { name: v.name }), 'Category renamed', () => setEditing(null));
  const remove = useSave((id: string) => api.del(`/categories/${id}`), 'Category deleted');
  return (
    <div className="space-y-5">
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(name.trim()); }} className="flex items-end gap-2">
        <TextInput label="New category" wrapperClassName="flex-1" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" loading={add.isPending} disabled={!name.trim()}>Add</Button>
      </form>
      <div>
        <h3 className="mb-1.5 px-1 text-[13px] font-medium uppercase tracking-wide text-muted">Your categories</h3>
        {cats.data?.custom.length ? (
          <ul className="divide-y overflow-hidden rounded-2xl bg-surface shadow-card">
            {cats.data.custom.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                {editing?.id === c.id ? (
                  <form className="flex flex-1 items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (editing.name.trim()) rename.mutate({ id: c.id, name: editing.name.trim() }); }}>
                    <input aria-label="Category name" autoFocus value={editing.name} maxLength={40} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} className="h-9 flex-1 rounded-[10px] bg-fill px-3 text-[15px] focus:outline-none focus:ring-[3px] focus:ring-accent/40" />
                    <IconButton label="Save name" type="submit"><Check className="size-4" /></IconButton>
                    <IconButton label="Cancel" onClick={() => setEditing(null)}><X className="size-4" /></IconButton>
                  </form>
                ) : (
                  <>
                    <span>{c.name}</span>
                    <span className="flex">
                      <IconButton label={`Rename ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}><Pencil className="size-4" /></IconButton>
                      <IconButton label={`Delete ${c.name}`} onClick={() => setRemoving(c)}><Trash2 className="size-4" /></IconButton>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-[13px] text-muted">No custom categories yet. The 14 defaults are always available.</p>}
      </div>
      <ConfirmDialog open={!!removing} title="Delete category?" message={`"${removing?.name}" will be removed. Categories still used by expenses cannot be deleted.`} confirmLabel="Delete category"
        onConfirm={() => remove.mutateAsync(removing!.id)} onClose={() => setRemoving(null)} />
    </div>
  );
}

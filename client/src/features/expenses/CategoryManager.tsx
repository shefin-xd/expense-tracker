import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/form';
import { ApiError } from '@/lib/api';
import { toast } from '@/store/toast';
import { useCategories, useCategoryMutations } from './api';

const msg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Try again.');

export function CategoryManager() {
  const { data } = useCategories();
  const m = useCategoryMutations();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const add = () => {
    if (!name.trim()) return;
    m.create.mutate(name.trim(), { onSuccess: () => { setName(''); toast.success('Category added'); }, onError: (e) => toast.error(msg(e)) });
  };
  const rename = () => {
    if (!editing || !editing.name.trim()) return;
    m.rename.mutate({ id: editing.id, name: editing.name.trim() }, { onSuccess: () => { setEditing(null); toast.success('Category renamed'); }, onError: (e) => toast.error(msg(e)) });
  };

  return (
    <div className="space-y-5">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Input aria-label="New category name" placeholder="New category, e.g. Gym" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" loading={m.create.isPending}>Add</Button>
      </form>

      <div>
        <h3 className="mb-2 text-[13px] font-medium">Your categories</h3>
        {data?.custom.length ? (
          <ul className="divide-y divide-line rounded border border-line">
            {data.custom.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                {editing?.id === c.id ? (
                  <>
                    <Input aria-label="Category name" autoFocus maxLength={40} value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); rename(); } if (e.key === 'Escape') setEditing(null); }} className="h-8" />
                    <IconButton label="Save name" onClick={rename}><Check className="h-4 w-4" /></IconButton>
                    <IconButton label="Cancel" onClick={() => setEditing(null)}><X className="h-4 w-4" /></IconButton>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm">{c.name}</span>
                    <IconButton label={`Rename ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}><Pencil className="h-4 w-4" /></IconButton>
                    <IconButton label={`Delete ${c.name}`} onClick={() => m.remove.mutate(c.id, { onSuccess: () => toast.success('Category deleted'), onError: (e) => toast.error(msg(e)) })}><Trash2 className="h-4 w-4" /></IconButton>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No custom categories yet.</p>}
        <p className="mt-2 text-xs text-muted">A category can’t be deleted while expenses still use it. Renaming updates your existing expenses and budgets.</p>
      </div>

      <div>
        <h3 className="mb-2 text-[13px] font-medium">Default categories</h3>
        <p className="text-sm text-muted">{data?.defaults.join(', ')}</p>
      </div>
    </div>
  );
}

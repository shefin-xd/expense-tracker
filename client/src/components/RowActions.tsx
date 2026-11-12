import { Eye, Pencil, Trash2 } from 'lucide-react';
import { IconButton } from './ui/Button';

export function RowActions({ name, onView, onEdit, onDelete }: { name: string; onView?: () => void; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="flex shrink-0 items-center">
      {onView && <IconButton label={`View ${name}`} onClick={onView}><Eye className="size-4" /></IconButton>}
      {onEdit && <IconButton label={`Edit ${name}`} onClick={onEdit}><Pencil className="size-4" /></IconButton>}
      {onDelete && <IconButton label={`Delete ${name}`} onClick={onDelete}><Trash2 className="size-4" /></IconButton>}
    </div>
  );
}

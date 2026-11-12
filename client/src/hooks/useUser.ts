import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/services/queries';
import type { DateFormatPref } from '@/utils/date';

export function useUser() {
  const { data } = useMe();
  return data!; // only used under <RequireAuth>, where the user is always loaded
}
export const useDateFormat = (): DateFormatPref => useMe().data?.preferences?.dateFormat ?? 'DD/MM/YYYY';
export const useResetSession = () => { const qc = useQueryClient(); return () => { qc.clear(); }; };

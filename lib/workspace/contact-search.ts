import type { StrategicContact } from '@/lib/workspace/types';

export function contactMatchesSearchQuery(
  contact: Pick<StrategicContact, 'fullName' | 'organization' | 'phone'>,
  q: string
) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;

  const phone = (contact.phone ?? '').toLowerCase();
  const queryDigits = needle.replace(/\D/g, '');
  const phoneDigits = phone.replace(/\D/g, '');

  return (
    contact.fullName.toLowerCase().includes(needle) ||
    contact.organization.toLowerCase().includes(needle) ||
    phone.includes(needle) ||
    (queryDigits.length >= 2 && phoneDigits.includes(queryDigits))
  );
}

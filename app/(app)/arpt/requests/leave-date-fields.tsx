'use client';

import { FrenchDateFormField } from '@/components/ui/french-datetime-fields';

export function ArptLeaveDateFields() {
  return (
    <>
      <FrenchDateFormField name="startDate" required />
      <FrenchDateFormField name="endDate" required />
    </>
  );
}

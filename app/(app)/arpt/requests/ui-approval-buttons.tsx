'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ApprovalButtons({ leaveId, disabled }: { leaveId: string; disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const decide = async (decision: 'approved' | 'rejected') => {
    setLoading(true);
    try {
      await fetch(`/api/arpt/leave-requests/${leaveId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={() => void decide('approved')} disabled={disabled || loading}>
        Approuver
      </Button>
      <Button size="sm" variant="outline" onClick={() => void decide('rejected')} disabled={disabled || loading}>
        Rejeter
      </Button>
    </div>
  );
}

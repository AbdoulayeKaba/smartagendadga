import Link from 'next/link';
import { ArrowLeft, CalendarRange } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AssistantAiView } from '@/components/dg/assistant-ai-view';

export default function AssistantAiPage() {
  return (
    <div className="app-page admin-theme dg-assistant-page dg-ai-page">
      <AdminPageHeader
        variant="flat"
        title="Lecture de la semaine"
        description="Charge à venir et tension des demandes. Le déroulé du jour reste dans le cockpit."
        actions={
          <Link href="/dg/assistant" className="dg-ai-back-link">
            <ArrowLeft className="h-3 w-3" aria-hidden />
            Retour cockpit
          </Link>
        }
      />

      <div className="dg-ai-banner">
        <CalendarRange className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <p>Le cockpit garde le déroulé du jour. Cette page lit la semaine : charge, mode et demandes à arbitrer.</p>
      </div>

      <AssistantAiView />
    </div>
  );
}

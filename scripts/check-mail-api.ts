import { listWorkspaceMail } from '../lib/services/workspace-service';

async function main() {
  const all = await listWorkspaceMail();
  const incoming2026 = await listWorkspaceMail({ direction: 'INCOMING', year: 2026 });
  console.log('all', all.length);
  console.log('incoming_2026', incoming2026.length);
  console.log(
    'incoming_refs',
    incoming2026.map((m) => m.reference)
  );
}

main().catch(console.error);

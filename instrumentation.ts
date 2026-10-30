export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startMailDispatchScheduler } = await import('@/lib/services/mail-dispatch-scheduler');
  startMailDispatchScheduler();
}

import { redirect } from 'next/navigation';

export default function GradesRedirectPage() {
  redirect('/admin/school/timetable');
}

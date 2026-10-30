import { redirect } from 'next/navigation';

export default function AbsencesRedirectPage() {
  redirect('/admin/school/timetable');
}

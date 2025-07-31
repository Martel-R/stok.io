// src/app/dashboard/attendance/[id]/page.tsx
import AttendanceClientPage from './attendance-client-page';

// This function is required for static export with dynamic routes.
// It tells Next.js not to pre-render any specific attendance pages at build time.
export async function generateStaticParams() {
  return [];
}

export default function AttendancePage({ params }: { params: { id: string } }) {
  return <AttendanceClientPage id={params.id} />;
}

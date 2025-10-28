import StokeLeadsDashboard from './callrecordings';
import { ProtectedRoute } from '@/components/protected-route';

export default function Home() {
  return (
    <ProtectedRoute>
      <StokeLeadsDashboard />
    </ProtectedRoute>
  );
}

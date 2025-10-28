'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import StokeLeadsDashboard from './callrecordings';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { getMyClientSettings } from '@/lib/client-settings';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [checkingSettings, setCheckingSettings] = useState(true);

  useEffect(() => {
    async function checkUserSettings() {
      if (!user) return;

      try {
        const supabase = getSupabaseBrowser();
        const settings = await getMyClientSettings(supabase);

        if (!settings) {
          // User hasn't configured their settings yet - redirect to setup
          router.push('/setup');
        } else {
          setCheckingSettings(false);
        }
      } catch (error) {
        console.error('Error checking settings:', error);
        setCheckingSettings(false);
      }
    }

    checkUserSettings();
  }, [user, router]);

  if (checkingSettings) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <StokeLeadsDashboard />
    </ProtectedRoute>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { getMyClientSettings, saveMyClientSettings } from '@/lib/client-settings';
import { Settings, Save, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    ghlLocationId: '',
    ghlAccessToken: '',
  });

  // Load existing settings
  useEffect(() => {
    async function loadSettings() {
      if (!user) return;

      try {
        setLoading(true);
        const supabase = getSupabaseBrowser();
        const settings = await getMyClientSettings(supabase);

        if (settings) {
          setFormData({
            ghlLocationId: settings.ghl_location_id,
            ghlAccessToken: settings.ghl_access_token,
          });
        }
      } catch (err) {
        console.error('Error loading settings:', err);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.ghlLocationId || !formData.ghlAccessToken) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setSaving(true);
      const supabase = getSupabaseBrowser();
      await saveMyClientSettings(
        supabase,
        formData.ghlLocationId,
        formData.ghlAccessToken
      );

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Page Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8">
            <div className="flex items-center gap-3 text-white">
              <Settings className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">Account Settings</h1>
                <p className="text-blue-100 mt-1">
                  Configure your HighLevel integration credentials
                </p>
              </div>
            </div>
          </div>

          {/* Settings Form */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Success Message */}
                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    <span>Settings saved successfully!</span>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">
                    Where to find these credentials:
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>
                      <strong>Location ID:</strong> HighLevel → Settings → Business Profile
                    </li>
                    <li>
                      <strong>Access Token:</strong> HighLevel → Settings → Integrations → API
                    </li>
                  </ul>
                </div>

                {/* Location ID Field */}
                <div>
                  <label
                    htmlFor="ghlLocationId"
                    className="block text-sm font-semibold text-slate-700 mb-2"
                  >
                    HighLevel Location ID
                  </label>
                  <input
                    type="text"
                    id="ghlLocationId"
                    value={formData.ghlLocationId}
                    onChange={(e) =>
                      setFormData({ ...formData, ghlLocationId: e.target.value })
                    }
                    placeholder="e.g., abc123xyz456"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Your HighLevel location/sub-account ID
                  </p>
                </div>

                {/* Access Token Field */}
                <div>
                  <label
                    htmlFor="ghlAccessToken"
                    className="block text-sm font-semibold text-slate-700 mb-2"
                  >
                    HighLevel Access Token
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      id="ghlAccessToken"
                      value={formData.ghlAccessToken}
                      onChange={(e) =>
                        setFormData({ ...formData, ghlAccessToken: e.target.value })
                      }
                      placeholder="Enter your private access token"
                      className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showToken ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Your private API access token (kept secure and encrypted)
                  </p>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Settings</span>
                      </>
                    )}
                  </button>

                  <Link
                    href="/"
                    className="px-6 py-3 text-slate-600 font-semibold rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            🔒 Security & Privacy
          </h3>
          <p className="text-sm text-slate-600">
            Your credentials are encrypted and stored securely in our database. They are
            only accessible to you and are never shared with third parties. Each user's
            data is completely isolated.
          </p>
        </div>
      </main>
    </div>
  );
}


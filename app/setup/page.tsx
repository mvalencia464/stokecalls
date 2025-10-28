'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { saveMyClientSettings } from '@/lib/client-settings';
import { Rocket, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

export default function SetupPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    ghlLocationId: '',
    ghlAccessToken: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

      // Redirect to dashboard
      router.push('/');
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      setSaving(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Welcome Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-10 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                <Rocket className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome to StokeCalls! 🎉
            </h1>
            <p className="text-blue-100 text-lg">
              Let's get you set up in just 2 minutes
            </p>
          </div>

          {/* Setup Form */}
          <div className="p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Connect Your HighLevel Account
              </h2>
              <p className="text-slate-600">
                Enter your HighLevel credentials to start analyzing your call recordings
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Message */}
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">
                  📋 How to find your credentials:
                </h3>
                <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                  <li>
                    Log in to your <strong>HighLevel</strong> account
                  </li>
                  <li>
                    <strong>Location ID:</strong> Go to Settings → Business Profile → Copy your Location ID
                  </li>
                  <li>
                    <strong>Access Token:</strong> Go to Settings → <strong>Private Integrations</strong> → Create New Integration
                    <div className="mt-2 ml-6 text-xs text-blue-700 bg-blue-100 rounded px-3 py-2">
                      <strong>⚠️ Required scopes:</strong> View Contacts, View Conversations, View Conversation Messages
                      <div className="mt-1 text-blue-600">
                        (Only these 3 scopes are needed - you can remove all others)
                      </div>
                    </div>
                  </li>
                </ol>
              </div>

              {/* Location ID Field */}
              <div>
                <label
                  htmlFor="ghlLocationId"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  HighLevel Location ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  id="ghlLocationId"
                  value={formData.ghlLocationId}
                  onChange={(e) =>
                    setFormData({ ...formData, ghlLocationId: e.target.value })
                  }
                  placeholder="e.g., abc123xyz456"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-base"
                  required
                />
              </div>

              {/* Access Token Field */}
              <div>
                <label
                  htmlFor="ghlAccessToken"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  HighLevel Access Token <span className="text-rose-500">*</span>
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
                    className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-base"
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
              </div>

              {/* Security Notice */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <strong>Secure & Private:</strong> Your credentials are encrypted and
                  stored securely. Only you can access your data.
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl text-lg"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Setting up your account...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    <span>Complete Setup & Start Analyzing</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-slate-600 text-sm">
            Need help? Contact support at{' '}
            <a
              href="mailto:support@stokeleads.com"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              support@stokeleads.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}


'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export default function FixCSSPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFixCSS = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const supabase = getSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Not authenticated. Please log in first.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/fix-css', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to clear custom CSS');
        setResult(data);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          🔧 Fix HighLevel Custom CSS
        </h1>
        
        <p className="text-gray-600 mb-6">
          This will remove the custom CSS from your HighLevel location that's blocking your dashboard.
        </p>

        <button
          onClick={handleFixCSS}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          {loading ? 'Clearing CSS...' : 'Clear Custom CSS'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-semibold">Error:</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            {result && (
              <details className="mt-2">
                <summary className="text-red-600 text-sm cursor-pointer">
                  Show details
                </summary>
                <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {result && !error && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-semibold">✅ Success!</p>
            <p className="text-green-600 text-sm mt-1">
              Custom CSS has been cleared. Try refreshing your HighLevel dashboard.
            </p>
            <details className="mt-2">
              <summary className="text-green-600 text-sm cursor-pointer">
                Show details
              </summary>
              <pre className="mt-2 text-xs bg-green-100 p-2 rounded overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800 font-semibold text-sm">💡 Alternative Solution:</p>
          <p className="text-blue-600 text-sm mt-1">
            If this doesn't work, you can also try:
          </p>
          <ol className="text-blue-600 text-sm mt-2 ml-4 list-decimal space-y-1">
            <li>Opening HighLevel in an incognito/private window</li>
            <li>Clearing your browser cache and cookies</li>
            <li>Using browser DevTools to manually remove the CSS (F12 → Elements)</li>
            <li>Contacting HighLevel support to reset your location settings</li>
          </ol>
        </div>
      </div>
    </div>
  );
}


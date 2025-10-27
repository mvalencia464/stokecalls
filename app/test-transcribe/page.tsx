'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function TestTranscribePage() {
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!audioUrl.trim()) {
      setError('Please enter an audio URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioUrl: audioUrl.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transcribe');
    } finally {
      setLoading(false);
    }
  };

  const testWithSample = () => {
    // AssemblyAI's sample audio file
    setAudioUrl('https://storage.googleapis.com/aai-web-samples/5_common_sports_injuries.mp3');
    setTimeout(() => handleTest(), 100);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Test AssemblyAI Transcription
          </h1>
          <p className="text-slate-600 mb-6">
            Test the transcription API with a sample audio file or your own URL
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Audio URL
              </label>
              <input
                type="text"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://example.com/audio.mp3"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={loading}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleTest}
                disabled={loading || !audioUrl.trim()}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Transcribing...
                  </>
                ) : (
                  'Transcribe'
                )}
              </button>

              <button
                onClick={testWithSample}
                disabled={loading}
                className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Use Sample Audio
              </button>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Error:</strong> {error}
                </div>
              </div>
            )}

            {result && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-emerald-700 mb-4">
                  <CheckCircle2 className="w-5 h-5" />
                  <strong>Transcription Complete!</strong>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-2">Summary</h3>
                    <p className="text-slate-700 text-sm bg-white p-3 rounded border border-slate-200">
                      {result.summary}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900 mb-2">Sentiment</h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        result.sentiment === 'POSITIVE' ? 'bg-emerald-100 text-emerald-700' :
                        result.sentiment === 'NEGATIVE' ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {result.sentiment}
                      </span>
                      <span className="text-slate-600 text-sm">
                        Score: {result.sentiment_score}%
                      </span>
                    </div>
                  </div>

                  {result.action_items && result.action_items.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-2">Action Items</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                        {result.action_items.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold text-slate-900 mb-2">Full Transcript</h3>
                    <div className="bg-white p-3 rounded border border-slate-200 max-h-96 overflow-y-auto">
                      {result.speakers && result.speakers.length > 0 ? (
                        <div className="space-y-3">
                          {result.speakers.map((speaker: any, idx: number) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium text-indigo-600">
                                Speaker {speaker.speaker}:
                              </span>{' '}
                              <span className="text-slate-700">{speaker.text}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-700 text-sm whitespace-pre-wrap">
                          {result.full_text}
                        </p>
                      )}
                    </div>
                  </div>

                  <details className="text-sm">
                    <summary className="cursor-pointer font-semibold text-slate-900 hover:text-indigo-600">
                      View Raw JSON
                    </summary>
                    <pre className="mt-2 bg-slate-900 text-slate-100 p-4 rounded overflow-x-auto text-xs">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">💡 Tips</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>The audio URL must be publicly accessible</li>
            <li>Supported formats: MP3, WAV, M4A, FLAC, and more</li>
            <li>Transcription typically takes 15-30% of the audio duration</li>
            <li>Speaker labels work best with 2-3 speakers</li>
          </ul>
        </div>
      </div>
    </div>
  );
}


'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Phone, Calendar, BarChart3, ChevronRight, ArrowLeft,
  MessageSquare, FileText, Sparkles, PlayCircle, CheckCircle2,
  AlertCircle, Clock, RefreshCw, Send, User, Bot, LogOut, Settings
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

/**
 * --- STOKE LEADS TECHNICAL SPECIFICATION (PROTOTYPE NOTES) ---
 * 
 * [Backend Architecture & Workflows - NOT IMPLEMENTED IN THIS FRONTEND-ONLY FILE]
 * 
 * 1. DB Schema (PostgreSQL recommendation):
 *    CREATE TABLE transcripts (
 *      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *      contact_id TEXT NOT NULL,
 *      message_id TEXT NOT NULL UNIQUE,
 *      location_id TEXT NOT NULL,
 *      full_text TEXT,
 *      summary TEXT,
 *      action_items JSONB, -- Array of strings
 *      sentiment TEXT,     -- 'POSITIVE', 'NEUTRAL', 'NEGATIVE'
 *      speakers JSONB,     -- Array of {speaker: string, text: string, start: int, end: int}
 *      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *      status TEXT DEFAULT 'processing' -- 'processing', 'completed', 'failed'
 *    );
 * 
 * 2. Core Workflow (Zapier/Make or Custom Node.js webhook handler):
 *    - Trigger: GHL Webhook 'Call Finished' (POST /api/webhooks/ghl-call-finished)
 *    - Step 1: Extract { contactId, locationId, messageId } from payload.
 *    - Step 2: GET GHL API /conversations/messages/{messageId} to retrieve audio URL.
 *    - Step 3: POST AssemblyAI /v2/transcript (audio_url, speaker_labels=true, summarization=true, etc.)
 *    - Step 4: Poll AssemblyAI until status='completed'.
 *    - Step 5: INSERT into DB.
 *    - Step 6: POST GHL API /contacts/{contactId}/notes with summary and link to this dashboard.
 *
 * 3. Env Vars Needed for Full Build:
 *    - GHL_API_KEY, ASSEMBLYAI_API_KEY, OPENAI_API_KEY, DATABASE_URL
 */

// --- UTILS ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- MOCK DATA ---

type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  company_name: string;
  last_call_date: string;
  latest_sentiment: Sentiment;
  status: 'lead' | 'client' | 'churned';
}

interface TranscriptSegment {
  speaker: 'A' | 'B'; // A = Agent, B = Contact
  text: string;
  start_ms: number;
  end_ms: number;
}

interface Transcript {
  id: string;
  contact_id: string;
  message_id: string;
  created_at: string;
  duration_seconds: number;
  sentiment: Sentiment;
  sentiment_score: number; // 0-100
  summary: string;
  action_items: string[];
  full_text: string;
  speakers: TranscriptSegment[];
}

const MOCK_CONTACTS: Contact[] = [
  { id: 'c_001', name: 'Sarah Jenkins', phone: '+1 (555) 123-4567', email: 'sarah.j@acmecorp.com', company_name: 'Acme Corp', last_call_date: '2023-10-26T14:30:00Z', latest_sentiment: 'POSITIVE', status: 'lead' },
  { id: 'c_002', name: 'Michael Rodriguez', phone: '+1 (555) 987-6543', email: 'm.rodriguez@globex.net', company_name: 'Globex', last_call_date: '2023-10-25T09:15:00Z', latest_sentiment: 'NEGATIVE', status: 'client' },
  { id: 'c_003', name: 'Emily Chen', phone: '+1 (555) 555-0199', email: 'echen@startuplabs.io', company_name: 'Startup Labs', last_call_date: '2023-10-27T11:00:00Z', latest_sentiment: 'NEUTRAL', status: 'lead' },
  { id: 'c_004', name: 'David Miller', phone: '+1 (555) 777-8888', email: 'dave@millers.com', company_name: 'Miller & Associates', last_call_date: '2023-10-20T16:45:00Z', latest_sentiment: 'POSITIVE', status: 'client' },
];

const MOCK_TRANSCRIPTS: Record<string, Transcript[]> = {
  'c_001': [
    {
      id: 't_101',
      contact_id: 'c_001',
      message_id: 'msg_ghl_123',
      created_at: '2023-10-26T14:30:00Z',
      duration_seconds: 450,
      sentiment: 'POSITIVE',
      sentiment_score: 85,
      summary: 'Sarah is highly interested in the Premium tier but needs clarification on the onboarding timeline. She mentioned her current contract expires next month, creating urgency.',
      action_items: [
        'Send Premium tier pricing PDF with onboarding roadmap.',
        'Schedule follow-up technical demo for next Tuesday.',
        'Confirm contract expiration date via email.'
      ],
      full_text: "[Agent] Hi Sarah, thanks for taking the time today. [Sarah] No problem, I'm really interested in what you have to offer...",
      speakers: [
        { speaker: 'A', text: "Hi Sarah, thanks for taking the time to jump on this call today. How are you?", start_ms: 0, end_ms: 3500 },
        { speaker: 'B', text: "I'm good, thanks. A bit rushed, but I really wanted to hear about the new premium features you emailed about.", start_ms: 4000, end_ms: 9500 },
        { speaker: 'A', text: "Absolutely. I can run through them in about 10 minutes. The main upgrade is the automated workflow engine. It saves teams about 20 hours a week.", start_ms: 10000, end_ms: 18000 },
        { speaker: 'B', text: "That sounds perfect. Our current contract with VendorX expires next month, so we need something in place fast. What's the onboarding timeline look like?", start_ms: 18500, end_ms: 26000 },
        { speaker: 'A', text: "Standard is 2 weeks, but we can expedite to 5 days if we sign by Friday.", start_ms: 26500, end_ms: 31000 },
        { speaker: 'B', text: "Okay, send me the pricing PDF and let's book a tech demo for my team next Tuesday.", start_ms: 31500, end_ms: 36000 },
      ]
    }
  ],
  'c_002': [
    {
      id: 't_102',
      contact_id: 'c_002',
      message_id: 'msg_ghl_124',
      created_at: '2023-10-25T09:15:00Z',
      duration_seconds: 120,
      sentiment: 'NEGATIVE',
      sentiment_score: 30,
      summary: 'Michael is frustrated with recent downtime and lack of support response. He is considering cancelling if the issue is not resolved immediately.',
      action_items: [
        'Escalate ticket #9942 to Tier 3 support IMMEDIATELY.',
        'Have Success Manager call Michael today by 2 PM EST.',
        'Prepare SLA breach credit memo.'
      ],
      full_text: "...",
      speakers: [
        { speaker: 'A', text: "Hi Michael, calling to check in on your account.", start_ms: 0, end_ms: 2000 },
        { speaker: 'B', text: "Look, I don't have time for a check-in. Your system has been down for 4 hours and nobody is answering my tickets. This is unacceptable.", start_ms: 2500, end_ms: 10000 },
        { speaker: 'A', text: "I completely understand your frustration, Michael. Let me look up that ticket right now.", start_ms: 10500, end_ms: 15000 },
      ]
    }
  ]
};

// --- COMPONENTS ---

const SentimentBadge = ({ sentiment }: { sentiment: Sentiment }) => {
  const config = {
    POSITIVE: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Sparkles },
    NEUTRAL: { bg: 'bg-slate-100', text: 'text-slate-700', icon: Clock },
    NEGATIVE: { bg: 'bg-rose-100', text: 'text-rose-700', icon: AlertCircle },
  };
  const { bg, text, icon: Icon } = config[sentiment];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", bg, text)}>
      <Icon className="w-3.5 h-3.5" />
      {sentiment.charAt(0) + sentiment.slice(1).toLowerCase()}
    </span>
  );
};

// --- MAIN APP COMPONENT ---

export default function StokeLeadsDashboard() {
  // State
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSentiment, setFilterSentiment] = useState<Sentiment | 'ALL'>('ALL');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useRealData, setUseRealData] = useState(true);

  // Fetch real contacts from HighLevel
  useEffect(() => {
    if (!useRealData) {
      setContacts(MOCK_CONTACTS);
      setLoading(false);
      return;
    }

    async function fetchContacts() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/contacts');

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch contacts');
        }

        const data = await response.json();
        setContacts(data.contacts || []);
      } catch (err) {
        console.error('Error fetching contacts:', err);
        setError(err instanceof Error ? err.message : 'Failed to load contacts');
        // Fallback to mock data on error
        setContacts(MOCK_CONTACTS);
      } finally {
        setLoading(false);
      }
    }

    fetchContacts();
  }, [useRealData]);

  // Derived State
  const selectedContact = contacts.find(c => c.id === selectedContactId);
  const filteredContacts = contacts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.company_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSentiment = filterSentiment === 'ALL' || c.latest_sentiment === filterSentiment;
    return matchesSearch && matchesSentiment;
  });

  // Handlers
  const handleContactSelect = (id: string) => {
    setSelectedContactId(id);
    setView('detail');
  };

  const handleBack = () => {
    setView('list');
    setSelectedContactId(null);
  };

  const toggleDataSource = () => {
    setUseRealData(!useRealData);
    setSelectedContactId(null);
    setView('list');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navbar - Mocking GHL Embedded Context */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Stoke<span className="text-indigo-600">Leads</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleDataSource}
            className={cn(
              "hidden md:flex items-center gap-2 text-sm px-3 py-1.5 rounded-full transition-colors",
              useRealData
                ? "text-emerald-700 bg-emerald-100 hover:bg-emerald-200"
                : "text-slate-500 bg-slate-100 hover:bg-slate-200"
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", useRealData ? "bg-emerald-500 animate-pulse" : "bg-slate-400")}></span>
            {useRealData ? 'HighLevel Data' : 'Mock Data'}
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
             <Settings className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-slate-200 rounded-full border-2 border-white shadow-sm overflow-hidden">
            <User className="w-full h-full p-1 text-slate-500" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <strong>Error loading contacts:</strong> {error}
              <button
                onClick={toggleDataSource}
                className="ml-2 underline hover:no-underline"
              >
                Switch to {useRealData ? 'mock' : 'real'} data
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
              <p className="text-slate-600">Loading contacts from HighLevel...</p>
            </div>
          </div>
        ) : view === 'list' ? (
          <ContactListView
            contacts={filteredContacts}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterSentiment={filterSentiment}
            setFilterSentiment={setFilterSentiment}
            onSelect={handleContactSelect}
            totalContacts={contacts.length}
          />
        ) : (
          <ContactDetailView
            contact={selectedContact!}
            onBack={handleBack}
          />
        )}
      </main>
    </div>
  );
}

// --- SUB-VIEWS ---

function ContactListView({
  contacts, searchTerm, setSearchTerm, filterSentiment, setFilterSentiment, onSelect, totalContacts
}: {
  contacts: Contact[],
  searchTerm: string,
  setSearchTerm: (s: string) => void,
  filterSentiment: Sentiment | 'ALL',
  setFilterSentiment: (s: Sentiment | 'ALL') => void,
  onSelect: (id: string) => void,
  totalContacts: number
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Call Intelligence</h2>
          <p className="text-slate-500 mt-1">
            Analyze your recent sales and support conversations.
            {totalContacts > 0 && <span className="ml-1">({totalContacts} total contacts)</span>}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search contacts..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-64 transition-all"
            />
          </div>
          <select 
            value={filterSentiment}
            onChange={(e) => setFilterSentiment(e.target.value as any)}
            className="pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          >
            <option value="ALL">All Sentiments</option>
            <option value="POSITIVE">Positive</option>
            <option value="NEUTRAL">Neutral</option>
            <option value="NEGATIVE">Negative</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium text-slate-600">Contact Name</th>
                <th className="px-6 py-4 font-medium text-slate-600">Company</th>
                <th className="px-6 py-4 font-medium text-slate-600">Last Call</th>
                <th className="px-6 py-4 font-medium text-slate-600">Latest Sentiment</th>
                <th className="px-6 py-4 font-medium text-slate-600 sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.map(contact => (
                <tr 
                  key={contact.id} 
                  onClick={() => onSelect(contact.id)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{contact.name}</div>
                    <div className="text-slate-500 text-xs">{contact.phone}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{contact.company_name}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {formatDistanceToNow(new Date(contact.last_call_date), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4">
                    <SentimentBadge sentiment={contact.latest_sentiment} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors inline-block" />
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No contacts found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ContactDetailView({ contact, onBack }: { contact: Contact, onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'insights' | 'transcript' | 'chat' | 'calls'>('insights');
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loadingTranscripts, setLoadingTranscripts] = useState(true);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  // Function to refresh transcripts (can be called after manual transcription)
  const refreshTranscripts = async () => {
    try {
      setLoadingTranscripts(true);
      const response = await fetch(`/api/transcripts?contactId=${contact.id}`);
      if (response.ok) {
        const data = await response.json();
        setTranscripts(data.transcripts || []);
      }
    } catch (err) {
      console.error('Error refreshing transcripts:', err);
    } finally {
      setLoadingTranscripts(false);
    }
  };

  // Fetch transcripts for this contact
  useEffect(() => {
    async function fetchTranscripts() {
      try {
        setLoadingTranscripts(true);
        setTranscriptError(null);
        const response = await fetch(`/api/transcripts?contactId=${contact.id}`);

        if (!response.ok) {
          throw new Error('Failed to fetch transcripts');
        }

        const data = await response.json();
        setTranscripts(data.transcripts || []);
      } catch (err) {
        console.error('Error fetching transcripts:', err);
        setTranscriptError(err instanceof Error ? err.message : 'Failed to load transcripts');
        // Fallback to mock data if available
        setTranscripts(MOCK_TRANSCRIPTS[contact.id] || []);
      } finally {
        setLoadingTranscripts(false);
      }
    }

    fetchTranscripts();
  }, [contact.id]);

  // Just use the newest transcript for detail view
  const activeTranscript = transcripts[0];

  if (loadingTranscripts) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-slate-600">Loading transcripts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center text-sm text-slate-500 hover:text-indigo-600 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Contacts
        </button>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-2xl font-semibold text-slate-500">
              {contact.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{contact.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-slate-600">
                <span className="flex items-center gap-1">
                  <BuildingIcon className="w-4 h-4" /> {contact.company_name}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-4 h-4" /> {contact.phone}
                </span>
                {activeTranscript && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(activeTranscript.created_at), 'MMM d, yyyy • h:mm a')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {activeTranscript && (
            <div>
              <ReanalyzeButton messageId={activeTranscript.message_id} onComplete={refreshTranscripts} />
            </div>
          )}
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          <TabButton 
            active={activeTab === 'insights'} 
            onClick={() => setActiveTab('insights')}
            icon={Sparkles}
          >
            AI Insights
          </TabButton>
          <TabButton 
            active={activeTab === 'transcript'} 
            onClick={() => setActiveTab('transcript')}
            icon={FileText}
          >
            Transcript
          </TabButton>
          <TabButton
            active={activeTab === 'chat'}
            onClick={() => setActiveTab('chat')}
            icon={MessageSquare}
          >
            Ask AI
          </TabButton>
          <TabButton
            active={activeTab === 'calls'}
            onClick={() => setActiveTab('calls')}
            icon={Phone}
          >
            Call Recordings
          </TabButton>
        </div>

        <div className="p-6 flex-1 bg-slate-50/50">
          {activeTab === 'insights' && (
            activeTranscript ? (
              <InsightsTab transcript={activeTranscript} />
            ) : (
              <NoTranscriptsMessage />
            )
          )}
          {activeTab === 'transcript' && (
            activeTranscript ? (
              <TranscriptTab transcript={activeTranscript} />
            ) : (
              <NoTranscriptsMessage />
            )
          )}
          {activeTab === 'chat' && (
            activeTranscript ? (
              <ChatTab transcript={activeTranscript} contactName={contact.name} />
            ) : (
              <NoTranscriptsMessage />
            )
          )}
          {activeTab === 'calls' && <CallsTab contactId={contact.id} onTranscriptionComplete={refreshTranscripts} />}
        </div>
      </div>
    </div>
  );
}

// --- TABS ---

// No transcripts message component
function NoTranscriptsMessage() {
  return (
    <div className="text-center py-20">
      <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-slate-700">No transcripts available yet</h3>
      <p className="text-slate-600 mt-2 max-w-md mx-auto">
        Transcripts will appear here after calls are completed and transcribed.
        Go to the <strong>Call Recordings</strong> tab to manually transcribe existing calls.
      </p>
    </div>
  );
}

function InsightsTab({ transcript }: { transcript: Transcript }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Summary Card */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Executive Summary
          </h3>
          <p className="text-slate-700 leading-relaxed">
            {transcript.summary}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Action Items
          </h3>
          <ul className="space-y-3">
            {transcript.action_items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <input 
                  type="checkbox" 
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-not-allowed"
                  disabled
                />
                <span className="text-slate-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Vitals Card */}
      <div className="space-y-6">
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Call Vitals</h3>
          
          <div className="space-y-6">
            <div>
              <div className="text-sm text-slate-500 mb-1 font-medium uppercase tracking-wider">Overall Sentiment</div>
              <div className="flex items-center justify-between">
                <SentimentBadge sentiment={transcript.sentiment} />
                <span className="font-bold text-2xl text-slate-900">{transcript.sentiment_score}/100</span>
              </div>
              <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full", 
                    transcript.sentiment === 'POSITIVE' ? 'bg-emerald-500' : 
                    transcript.sentiment === 'NEGATIVE' ? 'bg-rose-500' : 'bg-slate-400'
                  )}
                  style={{ width: `${transcript.sentiment_score}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div>
                <div className="text-sm text-slate-500 mb-1">Duration</div>
                <div className="font-semibold text-slate-900">
                  {Math.floor(transcript.duration_seconds / 60)}m {transcript.duration_seconds % 60}s
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">Speakers</div>
                <div className="font-semibold text-slate-900">2 Detected</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-indigo-900">
            <strong>Pro Tip:</strong> This call had a highly positive sentiment spike during the discussion of "automated workflows". Consider emphasizing this feature in follow-up materials.
          </p>
        </div>
      </div>
    </div>
  );
}

function TranscriptTab({ transcript }: { transcript: Transcript }) {
  const [search, setSearch] = useState('');

  const filteredSpeakers = transcript.speakers.filter(s => 
    s.text.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[700px]">
      {/* Transcript Toolbar */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10 rounded-t-xl">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search transcript text..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full text-sm"
          />
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors" title="Download Text">
            <FileText className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <PlayCircle className="w-4 h-4" /> Play Audio
          </button>
        </div>
      </div>

      {/* Transcript Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
        {filteredSpeakers.map((segment, idx) => {
          const isAgent = segment.speaker === 'A';
          return (
            <div key={idx} className={cn("flex gap-4 max-w-3xl", isAgent ? "flex-row-reverse ml-auto" : "mr-auto")}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium",
                isAgent ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-600"
              )}>
                {isAgent ? 'YOU' : 'HC'}
              </div>
              <div className={cn(
                "flex-1 space-y-1",
                isAgent ? "items-end text-right" : ""
              )}>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <span className="font-medium">
                    {isAgent ? 'Agent (Speaker A)' : 'Contact (Speaker B)'}
                  </span>
                  <span>•</span>
                  <span className="font-mono">
                    {formatMs(segment.start_ms)}
                  </span>
                </div>
                <div className={cn(
                  "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                  isAgent ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                )}>
                  {highlightText(segment.text, search)}
                </div>
              </div>
            </div>
          );
        })}
        {filteredSpeakers.length === 0 && (
          <div className="text-center text-slate-500 py-10">
            No transcript segments found matching "{search}"
          </div>
        )}
      </div>
    </div>
  );
}

function ChatTab({ transcript, contactName }: { transcript: Transcript, contactName: string }) {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: `Hello! I've analyzed the call with ${contactName}. Ask me anything about specific details, objections, or next steps.` }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [history]);

  const handleSend = async () => {
    if (!query.trim()) return;

    const userQuery = query;
    setHistory(prev => [...prev, { role: 'user', text: userQuery }]);
    setQuery('');
    setIsTyping(true);

    try {
      // Call the real AI API
      const response = await fetch('/api/ask-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messageId: transcript.message_id,
          question: userQuery,
          conversationHistory: history
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      setHistory(prev => [...prev, { role: 'ai', text: data.answer }]);
    } catch (error) {
      console.error('Error asking AI:', error);
      setHistory(prev => [...prev, {
        role: 'ai',
        text: "I'm sorry, I encountered an error while analyzing the transcript. Please try again."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[600px]">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-slate-700 font-medium rounded-t-xl">
        <Bot className="w-5 h-5 text-indigo-600" />
        Transcript AI Assistant
      </div>
      
      <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {history.map((msg, idx) => (
          <div key={idx} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[80%] p-4 rounded-2xl text-sm",
              msg.role === 'user' 
                ? "bg-indigo-600 text-white rounded-br-none" 
                : "bg-slate-100 text-slate-800 rounded-bl-none"
            )}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-100 p-4 rounded-2xl rounded-bl-none flex gap-2 items-center">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <input 
            type="text" 
            placeholder="Ask about budget, timeline, competitors..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
          <button 
            type="submit"
            disabled={!query.trim() || isTyping}
            className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

// --- SMALLER COMPONENTS & UTILS ---

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean, onClick: () => void, icon: any, children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
        active 
          ? "border-indigo-600 text-indigo-600 bg-indigo-50/50" 
          : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
      )}
    >
      <Icon className={cn("w-4 h-4", active ? "text-indigo-600" : "text-slate-400")} />
      {children}
    </button>
  );
}

function ReanalyzeButton({ messageId, onComplete }: { messageId: string; onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/reanalyze-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to re-analyze transcript');
      }

      // Refresh the transcripts to show updated analysis
      await onComplete();
    } catch (err) {
      console.error('Error re-analyzing:', err);
      setError(err instanceof Error ? err.message : 'Failed to re-analyze');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm disabled:opacity-70"
      >
        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-indigo-600")} />
        {loading ? "Re-analyzing..." : "Re-analyze Call"}
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

// Helper to format milliseconds to MM:SS
function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Helper to highlight search terms in text
function highlightText(text: string, searchTerm: string) {
  if (!searchTerm) return text;
  
  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-slate-900 rounded-sm px-0.5">{part}</mark>
        ) : (
          part
        )
      )}
    </span>
  );
}

// Calls Tab - Show available call recordings and allow manual transcription
function CallsTab({ contactId, onTranscriptionComplete }: { contactId: string, onTranscriptionComplete: () => void }) {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCalls() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/calls?contactId=${contactId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch calls');
        }

        const data = await response.json();
        setCalls(data.calls || []);
      } catch (err) {
        console.error('Error fetching calls:', err);
        setError(err instanceof Error ? err.message : 'Failed to load calls');
      } finally {
        setLoading(false);
      }
    }

    fetchCalls();
  }, [contactId]);

  const handleTranscribe = async (messageId: string) => {
    try {
      setTranscribingId(messageId);
      const response = await fetch('/api/transcribe-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messageId,
          contactId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = typeof errorData.details === 'string'
          ? errorData.details
          : typeof errorData.error === 'string'
          ? errorData.error
          : JSON.stringify(errorData.details || errorData.error || errorData);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Transcription started:', data);

      // Refresh transcripts immediately to show "processing" status
      onTranscriptionComplete();

      // Show success message with instructions
      alert(
        '✅ Transcription started!\n\n' +
        'The transcript is being processed by AssemblyAI.\n' +
        'This usually takes 30-60 seconds.\n\n' +
        'The page will automatically refresh when complete, or you can manually refresh to check the status.'
      );

      // Auto-refresh after 45 seconds to check if transcription is complete
      setTimeout(() => {
        console.log('Auto-refreshing transcripts...');
        onTranscriptionComplete();
      }, 45000);

    } catch (err) {
      console.error('Error transcribing call:', err);
      alert('❌ Failed to start transcription:\n\n' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setTranscribingId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-slate-600">Loading call recordings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <h3 className="text-lg font-medium text-rose-600">Error loading calls</h3>
        <p className="text-slate-600 mt-2">{error}</p>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-20">
        <Phone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-700">No call recordings found</h3>
        <p className="text-slate-600 mt-2">Call recordings will appear here after calls are completed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Found {calls.length} call recording{calls.length !== 1 ? 's' : ''}.</strong> Click "Transcribe" to process any call.
        </p>
      </div>

      <div className="space-y-3">
        {calls.map((call) => (
          <div key={call.id} className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Phone className="w-4 h-4 text-slate-500" />
                <span className="font-medium text-slate-900">
                  {call.direction === 'inbound' ? 'Incoming Call' : 'Outgoing Call'}
                </span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium",
                  call.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                )}>
                  {call.status}
                </span>
                {call.duration && (
                  <span className="text-xs text-slate-500">
                    {Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-600">
                {format(new Date(call.dateAdded), 'MMM d, yyyy • h:mm a')}
              </div>
              {!call.audioUrl && call.status === 'completed' && (
                <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Recording not available yet. Check HighLevel settings to ensure call recording is enabled.
                </div>
              )}
            </div>
            <button
              onClick={() => handleTranscribe(call.id)}
              disabled={transcribingId === call.id}
              className={cn(
                "px-4 py-2 rounded-lg font-medium text-sm transition-colors",
                transcribingId === call.id
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              )}
            >
              {transcribingId === call.id ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Transcribing...
                </span>
              ) : (
                'Transcribe'
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Extra icon for company
function BuildingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
  )
}

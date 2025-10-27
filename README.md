# StokeLeads - Call Transcription & AI Analysis Dashboard

A Next.js application that integrates with HighLevel to automatically transcribe phone calls and provide AI-powered insights.

## 🎯 Features

- **Real-time Call Transcription** - Automatically transcribe calls using AssemblyAI
- **AI-Powered Insights** - Get sentiment analysis, summaries, and action items
- **HighLevel Integration** - Seamlessly connects with your HighLevel CRM
- **Webhook Support** - Automatic transcription when calls finish
- **Manual Transcription** - Transcribe existing call recordings on-demand
- **Interactive Transcript** - Search and navigate through call transcripts
- **AI Chat Assistant** - Ask questions about call content

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file (use `.env.local.example` as template):

```bash
# HighLevel API Configuration
NEXT_PUBLIC_GHL_LOCATION_ID=your_location_id_here
GHL_ACCESS_TOKEN=your_access_token_here

# AssemblyAI for transcription
ASSEMBLYAI_API_KEY=your_assemblyai_key_here

# Optional: OpenAI for enhanced AI features
OPENAI_API_KEY=your_openai_key_here
```

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the result.

## 📚 Documentation

- **[REAL_TRANSCRIPTS_SETUP.md](./REAL_TRANSCRIPTS_SETUP.md)** - Complete setup guide for real transcripts
- **[HIGHLEVEL_INTEGRATION_GUIDE.md](./HIGHLEVEL_INTEGRATION_GUIDE.md)** - HighLevel API integration details
- **[TESTING_SUMMARY.md](./TESTING_SUMMARY.md)** - Testing and feature overview
- **[test-setup.md](./test-setup.md)** - Quick testing checklist

## 🔧 How It Works

### Automatic Transcription (via Webhook)
1. Call finishes in HighLevel
2. HighLevel sends webhook to your app
3. App fetches audio recording
4. Audio sent to AssemblyAI for transcription
5. Transcript saved to database
6. Available immediately in the UI

### Manual Transcription (via UI)
1. Navigate to a contact
2. Click "Call Recordings" tab
3. Click "Transcribe" on any call
4. Wait for processing
5. View results in other tabs

## 🛠️ Tech Stack

- **Framework**: Next.js 16.0.0 (App Router)
- **React**: 19.2.0
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Transcription**: AssemblyAI
- **CRM**: HighLevel API
- **Database**: JSON file storage (easily upgradeable to PostgreSQL/Supabase)

## 📖 Learn More

To learn more about the technologies used, check out:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

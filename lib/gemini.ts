import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }
  
  return new GoogleGenerativeAI(apiKey);
};

export interface TranscriptAnalysis {
  summary: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  sentiment_score: number; // 0-100
  action_items: string[];
  key_insights: string[];
  topics: string[];
}

/**
 * Analyze a call transcript using Gemini API
 * This is much cheaper than using AssemblyAI's analysis features
 */
export async function analyzeTranscript(
  fullText: string,
  speakers: Array<{ speaker: string; text: string; start_ms: number; end_ms: number }>
): Promise<TranscriptAnalysis> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Fast and cheap!

    // Format the transcript for better analysis
    const formattedTranscript = speakers
      .map(s => `${s.speaker}: ${s.text}`)
      .join('\n');

    const prompt = `You are an expert sales call analyst. Analyze the following phone call transcript and provide a comprehensive analysis.

TRANSCRIPT:
${formattedTranscript}

Provide your analysis in the following JSON format:
{
  "summary": "A concise 2-3 sentence executive summary of the entire call, highlighting the main purpose, key discussion points, and outcome",
  "sentiment": "POSITIVE, NEUTRAL, or NEGATIVE - the overall sentiment of the call",
  "sentiment_score": "A number from 0-100 where 0 is very negative, 50 is neutral, and 100 is very positive",
  "action_items": ["Array of specific, actionable next steps mentioned or implied in the call"],
  "key_insights": ["Array of important insights, objections, concerns, or opportunities mentioned"],
  "topics": ["Array of main topics discussed in the call"]
}

Important:
- The summary should cover the ENTIRE conversation, not just the beginning
- Be specific and actionable in action items
- Identify both explicit and implicit action items
- Consider the tone, word choice, and context for sentiment analysis
- Return ONLY valid JSON, no additional text`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Parse the JSON response
    // Remove markdown code blocks if present
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis: TranscriptAnalysis = JSON.parse(jsonText);
    
    // Validate and normalize the response
    return {
      summary: analysis.summary || 'No summary available',
      sentiment: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(analysis.sentiment) 
        ? analysis.sentiment 
        : 'NEUTRAL',
      sentiment_score: Math.min(100, Math.max(0, analysis.sentiment_score || 50)),
      action_items: Array.isArray(analysis.action_items) ? analysis.action_items : [],
      key_insights: Array.isArray(analysis.key_insights) ? analysis.key_insights : [],
      topics: Array.isArray(analysis.topics) ? analysis.topics : []
    };
  } catch (error) {
    console.error('Error analyzing transcript with Gemini:', error);
    
    // Return a fallback analysis
    return {
      summary: fullText.substring(0, 200) + '...',
      sentiment: 'NEUTRAL',
      sentiment_score: 50,
      action_items: [],
      key_insights: [],
      topics: []
    };
  }
}

/**
 * Answer a question about a transcript using Gemini
 * Used for the "Ask AI" chat feature
 */
export async function askAboutTranscript(
  question: string,
  fullText: string,
  speakers: Array<{ speaker: string; text: string; start_ms: number; end_ms: number }>,
  conversationHistory: Array<{ role: 'user' | 'ai'; text: string }> = []
): Promise<string> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Format the transcript
    const formattedTranscript = speakers
      .map(s => `${s.speaker}: ${s.text}`)
      .join('\n');

    // Build conversation context
    const historyContext = conversationHistory.length > 0
      ? '\n\nPrevious conversation:\n' + conversationHistory
          .slice(-5) // Only include last 5 messages for context
          .map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.text}`)
          .join('\n')
      : '';

    const prompt = `You are an AI assistant helping analyze a sales call transcript. Answer the user's question based ONLY on the information in the transcript.

TRANSCRIPT:
${formattedTranscript}
${historyContext}

USER QUESTION: ${question}

Provide a helpful, specific answer based on the transcript. If the information isn't in the transcript, say so. Be concise but thorough.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('Error asking Gemini about transcript:', error);
    return "I'm sorry, I encountered an error while analyzing the transcript. Please try again.";
  }
}


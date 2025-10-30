import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getClientSettings } from '@/lib/client-settings';
import { getContactIdsWithTranscripts } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { error: auth.error?.message || 'Not authenticated' },
        { status: auth.error?.status || 401 }
      );
    }

    // Get user's client settings
    const settings = await getClientSettings(auth.user.id);

    if (!settings) {
      return NextResponse.json(
        { error: 'Please configure your HighLevel credentials in Settings first.' },
        { status: 400 }
      );
    }

    const locationId = settings.ghl_location_id;
    const accessToken = settings.ghl_access_token;

    // Check if we should filter by contacts with call history
    const { searchParams } = new URL(request.url);
    const onlyWithCalls = searchParams.get('onlyWithCalls') === 'true';

    // Fetch contacts from HighLevel API
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        cache: 'no-store' // Disable caching to always get fresh data
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HighLevel API Error:', response.status, errorText);
      return NextResponse.json(
        { error: `HighLevel API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform HighLevel contacts to our app's format
    let contacts = (data.contacts || []).map((contact: any) => ({
      id: contact.id,
      name: contact.firstName && contact.lastName
        ? `${contact.firstName} ${contact.lastName}`.trim()
        : contact.firstName || contact.lastName || contact.email || 'Unknown',
      phone: contact.phone || contact.phoneNumber || 'N/A',
      email: contact.email || 'N/A',
      company_name: contact.companyName || contact.businessName || 'N/A',
      last_call_date: contact.dateUpdated || contact.dateAdded || new Date().toISOString(),
      latest_sentiment: 'NEUTRAL' as const, // Default until we have real transcript data
      status: (contact.tags?.includes('client') ? 'client' : 'lead') as 'lead' | 'client' | 'churned'
    }));

    // Filter by contacts with call history if requested
    if (onlyWithCalls) {
      try {
        const contactIdsWithCalls = await getContactIdsWithTranscripts();
        contacts = contacts.filter((contact: any) => contactIdsWithCalls.includes(contact.id));
      } catch (error) {
        console.error('Error filtering contacts by call history:', error);
        // If there's an error fetching transcripts, just return all contacts
      }
    }

    return NextResponse.json({
      contacts,
      total: data.total || contacts.length,
      count: contacts.length
    });

  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


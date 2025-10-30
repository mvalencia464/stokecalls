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

    // If filtering by calls, get the contact IDs first and fetch them individually
    let contactIdsWithCalls: string[] = [];
    if (onlyWithCalls) {
      try {
        contactIdsWithCalls = await getContactIdsWithTranscripts();
        console.log('[Contacts API] Contact IDs with transcripts:', contactIdsWithCalls.length, 'contacts');

        // Fetch each contact individually to ensure we get all of them
        const contactPromises = contactIdsWithCalls.map(async (contactId) => {
          try {
            const contactResponse = await fetch(
              `https://services.leadconnectorhq.com/contacts/${contactId}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Version': '2021-07-28',
                  'Content-Type': 'application/json'
                },
                cache: 'no-store'
              }
            );

            if (contactResponse.ok) {
              const contactData = await contactResponse.json();
              return contactData.contact;
            }
            return null;
          } catch (err) {
            console.error(`Error fetching contact ${contactId}:`, err);
            return null;
          }
        });

        const fetchedContacts = await Promise.all(contactPromises);
        const validContacts = fetchedContacts.filter(c => c !== null);

        // Transform to our format
        const contacts = validContacts.map((contact: any) => ({
          id: contact.id,
          name: contact.firstName && contact.lastName
            ? `${contact.firstName} ${contact.lastName}`.trim()
            : contact.firstName || contact.lastName || contact.email || 'Unknown',
          phone: contact.phone || contact.phoneNumber || 'N/A',
          email: contact.email || 'N/A',
          company_name: contact.companyName || contact.businessName || 'N/A',
          last_call_date: contact.dateUpdated || contact.dateAdded || new Date().toISOString(),
          latest_sentiment: 'NEUTRAL' as const,
          status: (contact.tags?.includes('client') ? 'client' : 'lead') as 'lead' | 'client' | 'churned'
        }));

        console.log('[Contacts API] Successfully fetched', contacts.length, 'contacts with calls');

        return NextResponse.json({
          contacts,
          total: contacts.length,
          count: contacts.length
        });

      } catch (error) {
        console.error('Error fetching contacts with call history:', error);
        // Fall through to fetch all contacts
      }
    }

    // Fetch all contacts (when not filtering or if filtering failed)
    const response = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
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
    const contacts = (data.contacts || []).map((contact: any) => ({
      id: contact.id,
      name: contact.firstName && contact.lastName
        ? `${contact.firstName} ${contact.lastName}`.trim()
        : contact.firstName || contact.lastName || contact.email || 'Unknown',
      phone: contact.phone || contact.phoneNumber || 'N/A',
      email: contact.email || 'N/A',
      company_name: contact.companyName || contact.businessName || 'N/A',
      last_call_date: contact.dateUpdated || contact.dateAdded || new Date().toISOString(),
      latest_sentiment: 'NEUTRAL' as const,
      status: (contact.tags?.includes('client') ? 'client' : 'lead') as 'lead' | 'client' | 'churned'
    }));

    console.log('[Contacts API] Total contacts from HighLevel:', contacts.length);

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


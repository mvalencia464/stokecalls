import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error?.message },
        { status: auth.error?.status || 401 }
      );
    }

    const locationId = process.env.NEXT_PUBLIC_GHL_LOCATION_ID;
    const accessToken = process.env.GHL_ACCESS_TOKEN;

    if (!locationId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing HighLevel credentials. Please check your .env.local file.' },
        { status: 500 }
      );
    }

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
    const contacts = (data.contacts || []).map((contact: any) => ({
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


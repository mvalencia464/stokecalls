import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getClientSettings } from '@/lib/client-settings';

/**
 * Emergency endpoint to remove custom CSS from HighLevel
 * This is a one-time fix for when custom CSS blocks the UI
 */
export async function POST(request: NextRequest) {
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

    console.log('🔧 Attempting to clear custom CSS for location:', locationId);

    // Try to update the location's custom values to remove CSS
    const response = await fetch(
      `https://services.leadconnectorhq.com/locations/${locationId}/customValues`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customCss: '' // Clear the custom CSS
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to update custom CSS:', response.status, errorText);
      
      // Try alternative endpoint
      console.log('🔄 Trying alternative endpoint...');
      const altResponse = await fetch(
        `https://services.leadconnectorhq.com/locations/${locationId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            settings: {
              customCss: ''
            }
          })
        }
      );

      if (!altResponse.ok) {
        const altErrorText = await altResponse.text();
        console.error('❌ Alternative endpoint also failed:', altResponse.status, altErrorText);
        return NextResponse.json(
          { 
            error: 'Failed to clear custom CSS', 
            details: errorText,
            altDetails: altErrorText 
          },
          { status: response.status }
        );
      }

      const altData = await altResponse.json();
      console.log('✅ Custom CSS cleared via alternative endpoint');
      return NextResponse.json({
        success: true,
        message: 'Custom CSS cleared successfully',
        data: altData
      });
    }

    const data = await response.json();
    console.log('✅ Custom CSS cleared successfully');

    return NextResponse.json({
      success: true,
      message: 'Custom CSS cleared successfully',
      data
    });

  } catch (error) {
    console.error('❌ Error clearing custom CSS:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clear custom CSS', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}


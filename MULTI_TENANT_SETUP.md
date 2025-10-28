# Multi-Tenant Setup Guide

## 🎉 Overview

StokeCalls now supports **true multi-tenancy**! Each client can have their own isolated workspace with their own HighLevel credentials. This means:

✅ **Unlimited Clients** - Add as many clients as you want  
✅ **Data Isolation** - Each client sees only their own contacts and calls  
✅ **Self-Service** - Clients manage their own GHL credentials  
✅ **No Rebuilds** - Add/update clients without redeploying  

---

## 🚀 Quick Start (5 Minutes)

### **Step 1: Run Database Migration**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **"New Query"**
4. Copy the contents of `supabase/client-settings-schema.sql`
5. Paste and click **"Run"**

This creates the `client_settings` table with Row Level Security policies.

### **Step 2: Deploy to Production**

The code has been pushed to GitHub. Netlify will auto-deploy.

### **Step 3: Set Up Your First Client**

1. Go to https://stokecalls.netlify.app/signup
2. Create an account with email/password
3. You'll be redirected to the **Setup Wizard**
4. Enter your HighLevel credentials:
   - **Location ID**: From HighLevel → Settings → Business Profile
   - **Access Token**: From HighLevel → Settings → Integrations → API
5. Click **"Complete Setup"**
6. Start analyzing calls! 🎉

---

## 👥 Adding New Clients

### **Option 1: Self-Service Signup (Recommended)**

1. Send your client the signup link: `https://stokecalls.netlify.app/signup`
2. They create their own account
3. They enter their own GHL credentials in the setup wizard
4. Done! They have instant access to their isolated workspace

### **Option 2: Create Account for Client**

1. Go to Supabase → **Authentication** → **Users**
2. Click **"Add User"** → **"Create new user"**
3. Enter their email and password
4. Toggle **"Auto Confirm User"** to ON
5. Click **"Create user"**
6. Send them their login credentials
7. They log in and complete the setup wizard

---

## 🔧 How It Works

### **Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                    StokeCalls App                        │
│                  (Single Deployment)                     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Supabase Database                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  client_settings (RLS Enabled)                    │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ user_id │ ghl_location_id │ ghl_access_token│  │  │
│  │  ├─────────────────────────────────────────────┤  │  │
│  │  │ user-1  │ loc-abc123      │ token-xyz       │  │  │
│  │  │ user-2  │ loc-def456      │ token-uvw       │  │  │
│  │  │ user-3  │ loc-ghi789      │ token-rst       │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              HighLevel API (Per-Client)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Client 1    │  │  Client 2    │  │  Client 3    │  │
│  │  Contacts    │  │  Contacts    │  │  Contacts    │  │
│  │  Calls       │  │  Calls       │  │  Calls       │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### **Data Flow**

1. **User logs in** → Supabase Auth verifies credentials
2. **User accesses dashboard** → App checks if user has settings
3. **No settings?** → Redirect to `/setup` wizard
4. **Has settings?** → Load dashboard
5. **User clicks contact** → API fetches user's settings from DB
6. **API calls HighLevel** → Uses user's specific credentials
7. **Data returned** → Only that user's contacts/calls

### **Security**

- **Row Level Security (RLS)**: Users can only see their own settings
- **Encrypted Storage**: Credentials stored securely in Supabase
- **No Cross-Contamination**: User A cannot access User B's data
- **API-Level Checks**: Every API call verifies user authentication

---

## 📝 Managing Client Settings

### **Users Can Update Their Own Settings**

1. Click the **Settings** icon (⚙️) in the top-right corner
2. Update Location ID or Access Token
3. Click **"Save Settings"**
4. Changes take effect immediately

### **Admin: View All Users**

1. Go to Supabase → **Authentication** → **Users**
2. See all registered users
3. Click a user to see details
4. Can manually delete users if needed

### **Admin: View Client Settings**

1. Go to Supabase → **Table Editor** → **client_settings**
2. See all client configurations
3. Can manually edit if needed (not recommended)

---

## 🔐 Security Best Practices

### **For You (Admin)**

✅ **Never share your Supabase service role key**  
✅ **Keep NEXT_PUBLIC_SUPABASE_ANON_KEY in Netlify env vars**  
✅ **Run RLS policies migration before adding clients**  
✅ **Monitor Supabase logs for suspicious activity**  

### **For Clients**

✅ **Use strong passwords for their accounts**  
✅ **Keep their GHL access tokens private**  
✅ **Use read-only GHL tokens if possible**  
✅ **Change passwords regularly**  

---

## 🧪 Testing Multi-Tenancy

### **Test 1: Create Two Users**

1. Create User A with email `usera@test.com`
2. Create User B with email `userb@test.com`
3. Configure different GHL credentials for each
4. Verify User A sees only their contacts
5. Verify User B sees only their contacts

### **Test 2: Settings Isolation**

1. Log in as User A
2. Go to Settings → Update Location ID
3. Log out
4. Log in as User B
5. Go to Settings → Verify User A's changes don't affect User B

### **Test 3: API Isolation**

1. Log in as User A
2. Open DevTools → Network tab
3. Click a contact
4. Verify API calls use User A's credentials
5. Repeat for User B

---

## 🚨 Troubleshooting

### **"Please configure your HighLevel credentials in Settings first"**

**Problem**: User hasn't completed setup wizard  
**Solution**: Redirect them to `/setup` or `/settings`

### **"Failed to fetch contacts"**

**Problem**: Invalid GHL credentials  
**Solution**: User should update their credentials in Settings

### **User sees another user's data**

**Problem**: RLS policies not applied  
**Solution**: Run `supabase/client-settings-schema.sql` again

### **Can't save settings**

**Problem**: Database permissions issue  
**Solution**: Check Supabase logs, verify RLS policies are enabled

---

## 📊 Scaling Considerations

### **Current Limits**

- **Users**: Unlimited (Supabase free tier: 50,000 monthly active users)
- **API Calls**: Limited by HighLevel rate limits per account
- **Database**: Supabase free tier: 500 MB storage

### **When to Upgrade**

- **>50,000 users**: Upgrade Supabase plan
- **>500 MB data**: Upgrade Supabase plan
- **High API usage**: Consider caching layer

---

## 🎯 Next Steps

### **Recommended Enhancements**

1. **Add user roles** (admin vs. client)
2. **Add organization/team support** (multiple users per GHL account)
3. **Add usage analytics** (track API calls per user)
4. **Add billing integration** (charge per user/usage)
5. **Add white-labeling** (custom branding per client)

---

## 📚 Files Reference

### **Database**
- `supabase/client-settings-schema.sql` - Client settings table and RLS policies

### **Backend**
- `lib/client-settings.ts` - Helper functions for settings CRUD
- `app/api/contacts/route.ts` - Uses per-user credentials
- `app/api/calls/route.ts` - Uses per-user credentials
- `app/api/transcribe-call/route.ts` - Uses per-user credentials

### **Frontend**
- `app/setup/page.tsx` - First-time setup wizard
- `app/settings/page.tsx` - Settings management page
- `app/page.tsx` - Auto-redirects to setup if needed

---

## ✅ Migration Checklist

Before deploying to production:

- [ ] Run `supabase/client-settings-schema.sql` in Supabase
- [ ] Verify RLS policies are enabled on `client_settings` table
- [ ] Test signup flow with a new user
- [ ] Test settings update flow
- [ ] Verify data isolation between users
- [ ] Update documentation for clients
- [ ] Notify existing users about new setup requirement

---

## 🆘 Support

If you encounter issues:

1. Check Supabase logs: **Logs** → **Postgres Logs**
2. Check browser console for errors
3. Verify RLS policies: **Table Editor** → **client_settings** → **Policies**
4. Test with a fresh user account

---

**Congratulations! Your app is now fully multi-tenant! 🎉**

Each client can now have their own isolated workspace with their own HighLevel credentials.


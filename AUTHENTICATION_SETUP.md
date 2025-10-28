# Authentication Setup Guide

## 🔒 Overview

StokeCalls now includes secure authentication powered by Supabase. This protects your private call transcripts and ensures only authorized users can access the application.

## ✅ What's Implemented

- **Email/Password Authentication** - Traditional login with email and password
- **Protected Routes** - All pages require authentication
- **Protected API Endpoints** - All API routes verify user sessions
- **Row Level Security (RLS)** - Database-level security policies
- **Session Management** - Automatic token refresh and persistence

---

## 🚀 Setup Instructions

### Step 1: Enable Email Auth in Supabase (2 minutes)

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers** (left sidebar)
3. Find **Email** provider
4. Make sure it's **enabled** (should be enabled by default)
5. Configure email settings:
   - **Enable email confirmations**: Toggle ON (recommended for production)
   - **Secure email change**: Toggle ON (recommended)

### Step 2: Update Environment Variables (1 minute)

Add the Supabase anon key to your `.env.local` file:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here  # ← ADD THIS
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

**Where to find the anon key:**
1. Go to **Settings** → **API** in Supabase
2. Copy the **anon** / **public** key (NOT the service_role key)
3. This key is safe to expose in the browser

### Step 3: Update Database Security Policies (2 minutes)

Run the authentication schema update in Supabase:

1. Go to **SQL Editor** in Supabase
2. Click **"New Query"**
3. Copy the contents of `supabase/auth-schema.sql`
4. Click **"Run"**

This will:
- Remove the old permissive policy
- Add new policies that require authentication
- Ensure only authenticated users can access transcripts

### Step 4: Create Your First User (1 minute)

**Option A: Via Sign Up Page**
1. Start your dev server: `npm run dev`
2. Go to http://localhost:3001/signup
3. Enter your email and password
4. Check your email for confirmation link (if email confirmations are enabled)
5. Click the confirmation link
6. Go to http://localhost:3001/login and sign in

**Option B: Via Supabase Dashboard (Skip Email Confirmation)**
1. Go to **Authentication** → **Users** in Supabase
2. Click **"Add User"** → **"Create new user"**
3. Enter email and password
4. Toggle **"Auto Confirm User"** to ON
5. Click **"Create user"**
6. Go to http://localhost:3001/login and sign in

---

## 🎯 How It Works

### Frontend Protection

1. **Auth Context** (`lib/auth-context.tsx`)
   - Manages user session state
   - Provides `signIn`, `signUp`, `signOut` functions
   - Automatically refreshes tokens

2. **Protected Routes** (`components/protected-route.tsx`)
   - Wraps pages that require authentication
   - Redirects to `/login` if not authenticated
   - Shows loading state while checking auth

3. **Authenticated API Calls** (`lib/api-client.ts`)
   - Automatically adds auth token to requests
   - Used by all frontend API calls

### Backend Protection

1. **API Route Middleware** (`lib/auth.ts`)
   - `requireAuth()` function verifies user session
   - Returns 401 if not authenticated
   - Used in all protected API routes

2. **Database Security** (Supabase RLS)
   - Row Level Security policies on `transcripts` table
   - Only authenticated users can read/write data
   - Enforced at the database level

---

## 🔐 Security Features

### What's Protected

✅ **All Pages** - Login required to access dashboard  
✅ **All API Routes** - Token verification on every request  
✅ **Database Access** - RLS policies enforce authentication  
✅ **Session Tokens** - Stored securely in browser  
✅ **Auto Logout** - Session expires after inactivity  

### What's NOT Protected (Intentionally)

❌ **Webhooks** - `/api/webhooks/*` routes are public (needed for external services)  
❌ **Login/Signup Pages** - Public access required  

---

## 👥 Managing Users

### Add New Users

**For Clients:**
1. Send them the signup link: `https://your-app-url.com/signup`
2. They create their own account
3. Confirm their email (if email confirmations enabled)
4. They can now access the app

**For Team Members:**
1. Create user via Supabase dashboard (faster)
2. Go to **Authentication** → **Users**
3. Click **"Add User"**
4. Enter their email and password
5. Toggle **"Auto Confirm User"** ON
6. Send them their credentials

### Remove Users

1. Go to **Authentication** → **Users** in Supabase
2. Find the user
3. Click the **"..."** menu
4. Select **"Delete user"**

---

## 🧪 Testing Authentication

### Test Login Flow

1. Start dev server: `npm run dev`
2. Go to http://localhost:3001
3. Should redirect to `/login`
4. Enter credentials and sign in
5. Should redirect to dashboard
6. Click logout button (top right)
7. Should redirect back to `/login`

### Test API Protection

Try accessing an API endpoint without auth:

```bash
curl http://localhost:3001/api/contacts
# Should return: {"error":"Unauthorized"}
```

Try with auth token:

```bash
# Get token from browser DevTools → Application → Local Storage → supabase.auth.token
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:3001/api/contacts
# Should return: {"contacts":[...]}
```

---

## 🚨 Troubleshooting

### "Missing Supabase environment variables"

**Problem:** App crashes on startup  
**Solution:** Make sure you added `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`

### "Unauthorized" errors after login

**Problem:** API calls fail with 401  
**Solution:** 
1. Check that `supabase/auth-schema.sql` was run
2. Verify RLS is enabled on `transcripts` table
3. Clear browser cache and re-login

### Email confirmation not working

**Problem:** Users don't receive confirmation emails  
**Solution:**
1. Check Supabase email settings in **Authentication** → **Email Templates**
2. For development, disable email confirmations or use Supabase dashboard to confirm users manually
3. For production, configure SMTP settings in Supabase

### Can't create first user

**Problem:** Signup page doesn't work  
**Solution:**
1. Use Supabase dashboard to create first user (see Step 4, Option B)
2. Make sure email provider is enabled in Supabase
3. Check browser console for errors

---

## 🌐 Production Deployment

### Environment Variables

Make sure these are set in your production environment (Netlify, Vercel, etc.):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Email Configuration

For production, configure custom SMTP in Supabase:

1. Go to **Settings** → **Auth** → **SMTP Settings**
2. Enter your SMTP credentials (SendGrid, Mailgun, etc.)
3. Test email delivery
4. Enable email confirmations

### Security Checklist

- [ ] Email confirmations enabled
- [ ] Strong password policy configured
- [ ] RLS policies applied to all tables
- [ ] Service role key kept secret (never in frontend)
- [ ] HTTPS enabled on production domain
- [ ] Rate limiting configured (optional)

---

## 📚 Next Steps

1. **Customize Email Templates** - Brand your confirmation emails in Supabase
2. **Add Password Reset** - Implement forgot password flow
3. **Add User Roles** - Create admin vs. client user types
4. **Add Multi-tenancy** - Isolate data per organization

---

## 🆘 Support

If you run into issues:

1. Check the [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
2. Review browser console for errors
3. Check Supabase logs in **Logs** → **Auth Logs**
4. Verify environment variables are set correctly


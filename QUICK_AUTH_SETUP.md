# Quick Authentication Setup (5 Minutes)

## ⚡ Fast Track Setup

### 1. Add Environment Variable (30 seconds)

Add this to your `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**Get the key:**
- Go to Supabase → Settings → API
- Copy the **anon** / **public** key

### 2. Update Database Security (1 minute)

In Supabase SQL Editor, run:

```sql
-- Copy from supabase/auth-schema.sql
DROP POLICY IF EXISTS "Allow all operations on transcripts" ON transcripts;

CREATE POLICY "Authenticated users can read transcripts" ON transcripts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert transcripts" ON transcripts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update transcripts" ON transcripts
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete transcripts" ON transcripts
  FOR DELETE USING (auth.uid() IS NOT NULL);
```

### 3. Create Your First User (1 minute)

**Easiest way - Via Supabase Dashboard:**

1. Supabase → Authentication → Users
2. Click "Add User" → "Create new user"
3. Enter email: `your@email.com`
4. Enter password: `your-password`
5. Toggle "Auto Confirm User" to **ON**
6. Click "Create user"

### 4. Test It! (30 seconds)

```bash
npm run dev
```

1. Go to http://localhost:3001
2. Should redirect to `/login`
3. Sign in with your credentials
4. You're in! 🎉

---

## 🎯 What Just Happened?

✅ Your app now requires login  
✅ All API routes are protected  
✅ Database access is secured  
✅ Ready for multiple users/clients  

---

## 👥 Adding More Users

**For clients:**
- Send them: `https://your-app-url.com/signup`
- They create their own account

**For team members:**
- Create via Supabase dashboard (faster)
- Supabase → Authentication → Users → Add User

---

## 🔄 Reverting (If Needed)

If something breaks:

```bash
git reset --hard pre-auth-checkpoint
```

This takes you back to before authentication was added.

---

## 📖 Full Documentation

See `AUTHENTICATION_SETUP.md` for complete details, troubleshooting, and production deployment.


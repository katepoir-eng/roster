# 📅 RosterApp

A free, installable staff rostering PWA built with Next.js, Supabase, and Vercel.

---

## ✅ Features

- **Manager**: create/delete shifts, view month calendar, manage staff, approve/decline swap requests
- **Staff**: view their shifts, mark availability, request shift swaps, receive notifications
- **PWA**: installable on iPhone & Android directly from browser (no App Store needed)
- **Free**: hosted on Vercel (free), database on Supabase (free tier)

---

## 🚀 Setup Guide (Step by Step)

### Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New Project**, give it a name (e.g. "rosterapp"), set a database password, choose a region close to you
3. Wait ~2 minutes for the project to be created

### Step 2 — Set up the database

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy the entire contents of `supabase-schema.sql` and paste it in
4. Click **Run** — you should see "Success"

### Step 3 — Create your manager account

1. In Supabase, go to **Authentication → Users**
2. Click **Invite user** or **Add user**
3. Enter your email and a password
4. After the user is created, go to **Table Editor → profiles**
5. Find your user row and set `role` to `manager`, add your `full_name`

### Step 4 — Get your Supabase API keys

1. Go to **Settings → API** in your Supabase project
2. Copy the **Project URL** and **anon public** key — you'll need these in Step 6

### Step 5 — Deploy to Vercel

1. Go to [github.com](https://github.com) and create a new repository (free)
2. Upload this entire project folder to the repository
   - Or use Git: `git init`, `git add .`, `git commit -m "init"`, `git remote add origin <your-repo-url>`, `git push`
3. Go to [vercel.com](https://vercel.com) and sign up (free, use your GitHub account)
4. Click **Add New Project**, import your GitHub repository
5. Click **Deploy** (don't fill anything in yet — we'll add env vars next)

### Step 6 — Add environment variables to Vercel

1. In your Vercel project, go to **Settings → Environment Variables**
2. Add these two variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
3. Click **Save**, then go to **Deployments** and click **Redeploy**

### Step 7 — Open your app!

Your app will be live at `https://your-project-name.vercel.app`

---

## 👥 Adding Staff

**Option A (Recommended):** In Supabase → Authentication → Users → Add User. Set email + password. Then in Table Editor → profiles, set their `full_name` and `role = staff`.

**Option B:** Use the Staff page in the app (Manager → Staff → + Add). Note: this uses Supabase's public signup which requires email confirmation unless you disable it in Authentication → Settings.

> **Tip:** To disable email confirmation (simpler for internal teams): Supabase → Authentication → Settings → uncheck "Enable email confirmations"

---

## 📱 Installing on Phones

Share your Vercel URL with staff and tell them:

- **iPhone (Safari):** Tap the Share button → "Add to Home Screen"
- **Android (Chrome):** Tap the ⋮ menu → "Add to Home Screen" or "Install App"

It will appear on their home screen like a native app!

---

## 📁 Project Structure

```
roster-app/
├── pages/
│   ├── index.js              # Login page
│   ├── notifications.js      # Notifications
│   ├── profile.js            # Profile & install instructions
│   ├── manager/
│   │   ├── roster.js         # Main roster calendar
│   │   ├── staff.js          # Staff management
│   │   └── swaps.js          # Approve/decline swaps
│   └── staff/
│       ├── shifts.js         # View my shifts + request swap
│       ├── availability.js   # Mark availability
│       └── swaps.js          # My swap requests
├── components/
│   └── BottomNav.js          # Bottom navigation bar
├── context/
│   └── AuthContext.js        # Auth state management
├── lib/
│   └── supabase.js           # Supabase client
├── styles/
│   └── globals.css           # Global styles
├── public/
│   └── manifest.json         # PWA manifest
├── supabase-schema.sql       # Run this in Supabase SQL Editor
├── .env.example              # Copy to .env.local for local dev
└── next.config.js            # Next.js + PWA config
```

---

## 🔧 Running Locally (Optional)

```bash
npm install
cp .env.example .env.local
# Fill in your Supabase credentials in .env.local
npm run dev
# Open http://localhost:3000
```

---

## 💡 Tips

- Monthly roster cycle: the calendar shows one month at a time; navigate with ‹ and ›
- Recurring shifts: mark a shift as "recurring" to visually flag it; you'll still need to add it each month (or duplicate via Supabase)
- The free Supabase tier supports up to 50,000 monthly active users — more than enough for 10 staff
- Vercel free tier has no limits for this kind of small app

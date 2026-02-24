-- ============================================
-- RosterApp Database Schema
-- Run this in: Supabase > SQL Editor > New Query
-- ============================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('manager', 'staff')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  title TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recur_day_of_week INTEGER,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Availability table
CREATE TABLE IF NOT EXISTS availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- Shift swap requests
CREATE TABLE IF NOT EXISTS swap_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE NOT NULL,
  target_staff_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  note TEXT,
  manager_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow trigger to insert profiles" ON profiles;

CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow trigger to insert profiles" ON profiles
  FOR INSERT WITH CHECK (true);

-- Shifts policies
DROP POLICY IF EXISTS "Shifts viewable by authenticated" ON shifts;
DROP POLICY IF EXISTS "Manager can insert shifts" ON shifts;
DROP POLICY IF EXISTS "Manager can update shifts" ON shifts;
DROP POLICY IF EXISTS "Manager can delete shifts" ON shifts;

CREATE POLICY "Shifts viewable by authenticated" ON shifts
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Manager can insert shifts" ON shifts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );
CREATE POLICY "Manager can update shifts" ON shifts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );
CREATE POLICY "Manager can delete shifts" ON shifts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

-- Availability policies
DROP POLICY IF EXISTS "Staff can manage own availability" ON availability;
DROP POLICY IF EXISTS "Manager can read all availability" ON availability;

CREATE POLICY "Staff can manage own availability" ON availability
  FOR ALL USING (auth.uid() = staff_id);
CREATE POLICY "Manager can read all availability" ON availability
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

-- Swap request policies
DROP POLICY IF EXISTS "Staff can create swap requests" ON swap_requests;
DROP POLICY IF EXISTS "Staff can view own swap requests" ON swap_requests;
DROP POLICY IF EXISTS "Manager can view all swap requests" ON swap_requests;
DROP POLICY IF EXISTS "Manager can update swap requests" ON swap_requests;

CREATE POLICY "Staff can create swap requests" ON swap_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Staff can view own swap requests" ON swap_requests
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = target_staff_id);
CREATE POLICY "Manager can view all swap requests" ON swap_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );
CREATE POLICY "Manager can update swap requests" ON swap_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

-- Notifications policies
DROP POLICY IF EXISTS "Users see own notifications" ON notifications;

CREATE POLICY "Users see own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Auto-create profile on signup
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
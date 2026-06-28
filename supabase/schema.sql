-- ============================================================
-- FLOWSTATE OS — COMPLETE DATABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'student');
CREATE TYPE member_status AS ENUM ('active', 'frozen', 'cancelled', 'trial');
CREATE TYPE payment_method AS ENUM ('stripe', 'cash', 'revolut', 'bank_transfer');
CREATE TYPE payment_status AS ENUM ('paid', 'pending', 'failed');
CREATE TYPE booking_status AS ENUM ('confirmed', 'waitlisted', 'cancelled');
CREATE TYPE membership_category AS ENUM ('adult', 'adult_3m', 'kids', 'other');
CREATE TYPE expense_category AS ENUM (
  'coaches', 'meta_ads', 'google_ads', 'editing_costs',
  'videographer_costs', 'other_marketing', 'miscellaneous'
);
CREATE TYPE email_trigger AS ENUM ('at_risk', 'welcome', 'payment_reminder', 'custom');

-- ============================================================
-- WAIVER VERSIONS
-- ============================================================

CREATE TABLE waiver_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_number TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default waiver
INSERT INTO waiver_versions (version_number, content) VALUES (
  '1.0',
  'By signing this waiver, I acknowledge that Brazilian Jiu Jitsu is a contact sport that carries inherent risks of injury. I voluntarily assume all risks associated with participation in classes, training, and activities at Flowstate Grappling. I agree to follow all instructions given by coaches and staff. I confirm that I am in good physical health and have no medical conditions that would prevent participation without medical clearance. I release Flowstate Grappling, its owners, coaches, and staff from any liability for injury, illness, or loss arising from my participation. This waiver is binding on myself, my heirs, and legal representatives.'
);

-- ============================================================
-- MEMBERSHIP TYPES
-- ============================================================

CREATE TABLE membership_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category membership_category NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  sessions_per_week INT,
  duration_months INT NOT NULL DEFAULT 1,
  stripe_price_id TEXT
);

-- Adults (1 Month)
INSERT INTO membership_types (name, category, price, sessions_per_week, duration_months) VALUES
  ('Once Weekly — 1 Month', 'adult', 49, 1, 1),
  ('Twice Weekly — 1 Month', 'adult', 59, 2, 1),
  ('Three Times Weekly — 1 Month', 'adult', 69, 3, 1),
  ('Unlimited — 1 Month', 'adult', 79, NULL, 1);

-- Adults (3 Months)
INSERT INTO membership_types (name, category, price, sessions_per_week, duration_months) VALUES
  ('Once Weekly — 3 Months', 'adult_3m', 129, 1, 3),
  ('Twice Weekly — 3 Months', 'adult_3m', 159, 2, 3),
  ('Three Times Weekly — 3 Months', 'adult_3m', 189, 3, 3),
  ('Unlimited — 3 Months', 'adult_3m', 209, NULL, 3);

-- Kids
INSERT INTO membership_types (name, category, price, sessions_per_week, duration_months) VALUES
  ('Once Weekly — Kids', 'kids', 49, 1, 1),
  ('Dual Membership — Kids', 'kids', 89, 2, 1),
  ('Triple Membership — Kids', 'kids', 125, 3, 1);

-- Other
INSERT INTO membership_types (name, category, price, sessions_per_week, duration_months) VALUES
  ('Drop In', 'other', 20, NULL, 0);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  role user_role NOT NULL DEFAULT 'student',
  membership_type_id UUID REFERENCES membership_types(id),
  membership_start_date DATE,
  membership_renewal_date DATE,
  payment_method payment_method,
  status member_status NOT NULL DEFAULT 'trial',
  deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
  waiver_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  waiver_accepted_at TIMESTAMPTZ,
  waiver_version TEXT REFERENCES waiver_versions(version_number),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Member'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- CLASSES (recurring weekly schedule)
-- ============================================================

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_capacity INT NOT NULL DEFAULT 15,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLASS SESSIONS (instances of recurring classes)
-- ============================================================

CREATE TABLE class_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, session_date)
);

-- ============================================================
-- BOOKINGS
-- ============================================================

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status booking_status NOT NULL DEFAULT 'confirmed',
  booked_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  UNIQUE(session_id, user_id)
);

-- Auto-waitlist when class is full
CREATE OR REPLACE FUNCTION check_booking_capacity()
RETURNS TRIGGER AS $$
DECLARE
  confirmed_count INT;
  max_cap INT;
BEGIN
  SELECT COUNT(*) INTO confirmed_count
  FROM bookings
  WHERE session_id = NEW.session_id AND status = 'confirmed';

  SELECT c.max_capacity INTO max_cap
  FROM class_sessions cs
  JOIN classes c ON c.id = cs.class_id
  WHERE cs.id = NEW.session_id;

  IF confirmed_count >= max_cap THEN
    NEW.status := 'waitlisted';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_booking_insert
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION check_booking_capacity();

-- Promote waitlist when booking is cancelled
CREATE OR REPLACE FUNCTION promote_waitlist()
RETURNS TRIGGER AS $$
DECLARE
  next_waitlisted UUID;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'confirmed' THEN
    SELECT id INTO next_waitlisted
    FROM bookings
    WHERE session_id = NEW.session_id AND status = 'waitlisted'
    ORDER BY booked_at ASC
    LIMIT 1;

    IF next_waitlisted IS NOT NULL THEN
      UPDATE bookings SET status = 'confirmed' WHERE id = next_waitlisted;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_booking_cancelled
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION promote_waitlist();

-- ============================================================
-- ATTENDANCE
-- ============================================================

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attended BOOLEAN NOT NULL DEFAULT TRUE,
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  adjusted_by UUID REFERENCES profiles(id),
  UNIQUE(session_id, user_id)
);

-- Auto-create attendance records from confirmed bookings
CREATE OR REPLACE FUNCTION create_attendance_from_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    INSERT INTO attendance (session_id, user_id)
    VALUES (NEW.session_id, NEW.user_id)
    ON CONFLICT (session_id, user_id) DO UPDATE SET attended = TRUE;
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE attendance
    SET attended = FALSE
    WHERE session_id = NEW.session_id AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_booking_change
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION create_attendance_from_booking();

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  membership_type_id UUID REFERENCES membership_types(id),
  amount NUMERIC(10,2) NOT NULL,
  method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXPENSES
-- ============================================================

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category expense_category NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT NOT NULL,
  paid_at DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID NOT NULL REFERENCES profiles(id)
);

-- ============================================================
-- EMAIL TEMPLATES
-- ============================================================

CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  trigger email_trigger NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default email templates
INSERT INTO email_templates (name, subject, body, trigger) VALUES
  (
    'At Risk — Check In',
    'We miss you at Flowstate! 👋',
    '<p>Hi {{name}},</p><p>We noticed it''s been a while since your last class. Your progress matters to us — come back and keep rolling!</p><p>If anything is holding you back, reply to this email and we''ll help.</p><p>See you on the mats,<br/>The Flowstate Team</p>',
    'at_risk'
  ),
  (
    'Welcome to Flowstate',
    'Welcome to Flowstate Grappling! 🥋',
    '<p>Hi {{name}},</p><p>Welcome to Flowstate Grappling! We''re stoked to have you.</p><p>Your first class is booked. Here''s what to bring: comfortable athletic wear, water, and a positive attitude.</p><p>See you on the mats,<br/>The Flowstate Team</p>',
    'welcome'
  ),
  (
    'Payment Reminder',
    'Your membership renewal is coming up',
    '<p>Hi {{name}},</p><p>Just a heads up — your membership renews on {{renewal_date}}. Make sure your payment is up to date to keep training uninterrupted.</p><p>The Flowstate Team</p>',
    'payment_reminder'
  );

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiver_versions ENABLE ROW LEVEL SECURITY;

-- Helper: is current user an admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles: users see their own, admins see all
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id OR is_admin());
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can delete profiles" ON profiles FOR DELETE USING (is_admin());

-- Classes: everyone can read, only admins can write
CREATE POLICY "Anyone can view classes" ON classes FOR SELECT USING (true);
CREATE POLICY "Admins can manage classes" ON classes FOR ALL USING (is_admin());

-- Class sessions: everyone can read, only admins can write
CREATE POLICY "Anyone can view sessions" ON class_sessions FOR SELECT USING (true);
CREATE POLICY "Admins can manage sessions" ON class_sessions FOR ALL USING (is_admin());

-- Bookings: users see their own, admins see all
CREATE POLICY "Users can view own bookings" ON bookings FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users can create own bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users can update own bookings" ON bookings FOR UPDATE USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Admins can delete bookings" ON bookings FOR DELETE USING (is_admin());

-- Attendance: users see own, admins see all
CREATE POLICY "Users can view own attendance" ON attendance FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Admins can manage attendance" ON attendance FOR ALL USING (is_admin());

-- Payments: users see own, admins see all
CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Admins can manage payments" ON payments FOR ALL USING (is_admin());

-- Expenses: admin only
CREATE POLICY "Admins can manage expenses" ON expenses FOR ALL USING (is_admin());

-- Email templates: admin only
CREATE POLICY "Admins can manage email templates" ON email_templates FOR ALL USING (is_admin());

-- Membership types: everyone reads, admin writes
CREATE POLICY "Anyone can view membership types" ON membership_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage membership types" ON membership_types FOR ALL USING (is_admin());

-- Waiver: everyone reads
CREATE POLICY "Anyone can view waiver" ON waiver_versions FOR SELECT USING (true);
CREATE POLICY "Admins can manage waiver" ON waiver_versions FOR ALL USING (is_admin());

-- ============================================================
-- HELPFUL VIEWS
-- ============================================================

-- Dashboard stats view
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM profiles WHERE status = 'active' AND role = 'student') AS active_members,
  (SELECT COUNT(*) FROM profiles WHERE status = 'trial' AND role = 'student') AS trial_members,
  (SELECT COUNT(*) FROM profiles WHERE role = 'student' AND created_at >= date_trunc('month', NOW())) AS new_members_this_month,
  (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid' AND paid_at >= date_trunc('month', NOW())) AS month_revenue,
  (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE paid_at >= date_trunc('month', NOW())) AS month_expenses,
  (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'pending') AS outstanding_payments;

-- At risk members view
CREATE OR REPLACE VIEW at_risk_members AS
SELECT p.*, MAX(a.marked_at) AS last_attendance
FROM profiles p
LEFT JOIN attendance a ON a.user_id = p.id AND a.attended = TRUE
WHERE p.status = 'active' AND p.role = 'student'
GROUP BY p.id
HAVING MAX(a.marked_at) < NOW() - INTERVAL '14 days' OR MAX(a.marked_at) IS NULL;

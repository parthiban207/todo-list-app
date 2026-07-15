-- ==========================================
-- Zenith Todo Database Setup & RLS Policies
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. Enable Row-Level Security (RLS) on all tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Allow authenticated user access" ON tasks;
DROP POLICY IF EXISTS "Allow anon access" ON tasks;
DROP POLICY IF EXISTS "Allow authenticated user access" ON categories;
DROP POLICY IF EXISTS "Allow anon access" ON categories;
DROP POLICY IF EXISTS "Allow authenticated user access" ON subtasks;
DROP POLICY IF EXISTS "Allow anon access" ON subtasks;
DROP POLICY IF EXISTS "Allow authenticated user access" ON notifications;
DROP POLICY IF EXISTS "Allow anon access" ON notifications;

-- ==========================================
-- TASKS POLICIES
-- ==========================================

-- Policy for Authenticated users (logs in via Supabase Auth)
CREATE POLICY "Allow authenticated user access" ON tasks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy for Anonymous local users (running locally without logging in)
CREATE POLICY "Allow anon access" ON tasks
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- CATEGORIES POLICIES
-- ==========================================

CREATE POLICY "Allow authenticated user access" ON categories
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow anon access" ON categories
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- SUBTASKS POLICIES
-- ==========================================

CREATE POLICY "Allow authenticated user access" ON subtasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE tasks.id = subtasks.task_id 
      AND tasks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE tasks.id = subtasks.task_id 
      AND tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow anon access" ON subtasks
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- NOTIFICATIONS POLICIES
-- ==========================================

CREATE POLICY "Allow authenticated user access" ON notifications
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow anon access" ON notifications
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

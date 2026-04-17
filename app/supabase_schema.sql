-- Run this inside the Supabase SQL Editor

-- 1. Create a table for student profiles
CREATE TABLE public.students (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    student_id TEXT UNIQUE NOT NULL,
    roll_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Set Row Level Security (RLS) on the students table
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 3. Create policies so users can only view and update their own data
CREATE POLICY "Users can view their own student data."
ON public.students FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own student data."
ON public.students FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own student data."
ON public.students FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Enable a trigger to automatically create a profile placeholder (optional, but we insert manually in Flutter)

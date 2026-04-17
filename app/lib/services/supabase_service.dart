import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  static final SupabaseClient client = Supabase.instance.client;

  // Sign up a student
  static Future<AuthResponse> signUp({
    required String studentId,
    required String password,
    required String rollNo,
    required String name,
    required String department,
  }) async {
    // Generate an email internally for Supabase Auth since we login with Roll Number
    final email = '$rollNo@hitam.org';
    final response = await client.auth.signUp(
      email: email,
      password: password,
    );

    if (response.user != null) {
      // Create student entry in the database securely linked to their UUID
      await client.from('students').insert({
        'id': response.user!.id,
        'student_id': studentId,
        'roll_no': rollNo,
        'name': name,
        'department': department,
      });
    }

    return response;
  }

  // Log in using roll number
  static Future<AuthResponse> signIn({
    required String rollNo,
    required String password,
  }) async {
    final email = '$rollNo@hitam.org';
    return await client.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  // Sign out
  static Future<void> signOut() async {
    await client.auth.signOut();
  }

  // Get current session
  static Session? get session => client.auth.currentSession;
  static User? get user => client.auth.currentUser;

  // Retrieve student details for the currently logged-in user
  static Future<Map<String, dynamic>?> getCurrentStudentProfile() async {
    final currentUser = user;
    if (currentUser == null) return null;

    final data = await client
        .from('students')
        .select()
        .eq('id', currentUser.id)
        .maybeSingle();

    return data;
  }
}

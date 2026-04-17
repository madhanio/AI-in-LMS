import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/supabase_service.dart';

class AuthProvider extends ChangeNotifier {
  Map<String, dynamic>? _currentStudent;
  bool _isLoading = true;

  Map<String, dynamic>? get currentStudent => _currentStudent;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => SupabaseService.session != null;

  AuthProvider() {
    _init();
  }

  Future<void> _init() async {
    // Check initial state
    if (SupabaseService.session != null) {
      await fetchStudentData();
    } else {
      _isLoading = false;
      notifyListeners();
    }

    // Listen to changes
    Supabase.instance.client.auth.onAuthStateChange.listen((data) async {
      final AuthChangeEvent event = data.event;
      if (event == AuthChangeEvent.signedIn) {
        await fetchStudentData();
      } else if (event == AuthChangeEvent.signedOut) {
        _currentStudent = null;
        _isLoading = false;
        notifyListeners();
      }
    });
  }

  Future<void> fetchStudentData() async {
    _isLoading = true;
    notifyListeners();

    try {
      final studentData = await SupabaseService.getCurrentStudentProfile();
      _currentStudent = studentData;
    } catch (e) {
      debugPrint('Error fetching student data: $e');
      _currentStudent = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logOut() async {
    await SupabaseService.signOut();
  }
}

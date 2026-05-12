import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/app_context.dart';
import '../models/fab_clearance.dart';

class AppContextProvider extends ChangeNotifier {
  AppContext _currentContext = AppContext.defaultContext();
  AppContext? _previousContext;
  
  // Debouncer for rapid navigation
  Timer? _debounceTimer;

  // Global FAB clearance signal
  FabClearance _fabClearance = FabClearance.none;

  // Readiness flag
  bool _isReady = true;

  AppContext get currentContext => _currentContext;
  AppContext? get previousContext => _previousContext;
  FabClearance get fabClearance => _fabClearance;
  bool get isReady => _isReady;

  Future<void> initialize() async {
    // Simulate loading/initialization time if necessary
    // Here we can also read last context from Hive if we wanted to persist it
    _isReady = true;
    notifyListeners();
  }

  void updateContext(AppContext newContext) {
    _previousContext = _currentContext;
    _currentContext = newContext;
    notifyListeners();
  }

  void updateFabClearance(FabClearance clearance) {
    if (_fabClearance.totalClearance != clearance.totalClearance) {
      _fabClearance = clearance;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    super.dispose();
  }
}

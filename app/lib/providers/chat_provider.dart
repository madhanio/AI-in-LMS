import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:hive_flutter/hive_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/message.dart';
import '../models/chat_session.dart';
import '../models/hive_constants.dart';
import '../models/app_context.dart';
import '../constants.dart';

class ChatProvider extends ChangeNotifier {
  final List<Message> _messages = [];
  final List<ChatSession> _history = [];

  List<String> _subjects = [];
  List<String> _suggestions = [];
  bool _isLoadingSubjects = false;
  bool _isLoadingSuggestions = false;
  String? _selectedSubject;
  String? _currentSessionId;
  bool _isStreaming = false;
  bool _isTyping = false;
  // ignore: unused_field
  bool _greetingGenerated = false;

  // UPGRADE 2 — Mock student profile (schema matches real auth fields for painless swap)
  // TODO: Replace values with data from your auth provider (Supabase auth user metadata)
  final Map<String, dynamic> _studentProfile = {
    'name': 'Madhan', // auth.user.userMetadata['full_name']
    'rollNumber': '24HITCS', // auth.user.userMetadata['roll_number']
    'year': '2nd Year', // auth.user.userMetadata['year']
    'branch': 'CSE', // auth.user.userMetadata['branch']
    'section': 'A', // auth.user.userMetadata['section']
  };

  List<Message> get messages => _messages;
  List<ChatSession> get history => _history;
  List<String> get subjects => _subjects;
  List<String> get suggestions => _suggestions;
  bool get isLoadingSubjects => _isLoadingSubjects;
  bool get isLoadingSuggestions => _isLoadingSuggestions;
  String? get selectedSubject => _selectedSubject;
  bool get isStreaming => _isStreaming;
  bool get isTyping => _isTyping;
  int _lastNotifyTime = 0;

  // Base URL configuration
  final String _baseUrl = Constants.apiBaseUrl;

  late Box _chatBox;

  ChatProvider() {
    _initHive();
    fetchSubjects();
    _loadHistory();
  }

  Future<void> _initHive() async {
    _chatBox = await Hive.openBox(HiveConstants.chatBox);
    final savedMessages = _chatBox.get('active_messages');
    if (savedMessages != null && savedMessages is List) {
      _messages.addAll(savedMessages.cast<Message>());
      _greetingGenerated = true;
      notifyListeners();
    } else {
      generateInitialGreeting();
    }
  }

  Future<void> fetchSubjects() async {
    _isLoadingSubjects = true;
    notifyListeners();
    // Also trigger suggestions to load in parallel
    fetchSuggestions();

    try {
      final res = await http
          .get(Uri.parse('$_baseUrl/subjects'))
          .timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        _subjects = List<String>.from(data['subjects']);
      }
    } catch (e) {
      debugPrint('Error fetching subjects: $e');
    } finally {
      _isLoadingSubjects = false;
      notifyListeners();
    }
  }

  Future<void> fetchSuggestions() async {
    _isLoadingSuggestions = true;
    notifyListeners();

    try {
      final res = await http
          .get(Uri.parse('$_baseUrl/prompts'))
          .timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        _suggestions = List<String>.from(data['suggestions']);
      }
    } catch (e) {
      debugPrint('Error fetching suggestions: $e');
      // Fallback suggestions
      _suggestions = [
        "What's on my study schedule? 📅",
        "Summarize my top PDF 📄",
        "Give me a quick quiz 🧠",
      ];
    } finally {
      _isLoadingSuggestions = false;
      notifyListeners();
    }
  }

  /// Generates a fresh, unique greeting for a new session
  Future<void> generateInitialGreeting() async {
    if (_messages.isNotEmpty || _isTyping) return;

    _isTyping = true;
    _greetingGenerated = true;
    notifyListeners();

    // 🕵️ SILENT REQUEST: Trigger a professional introduction as the Academic Mentor
    const prompt =
        "Introduce yourself as the Academic Mentor. Generate a single, very short, and calm Zen-like professional greeting. Strictly one short line only. CRITICAL: Do not use any XML tags, <antArtifact>, <artifact>, or markdown blocks. Just plain text. Vibe: Specialized LMS Assistant.";
    await _getAIResponse(prompt, [], isGreeting: true);
  }

  /// 🏛️ ARCHIVE LOGIC: Live updates the active session to history and Hive
  Future<void> _updateOrSaveCurrentSession() async {
    // Save to Hive
    final messagesToSave = _messages.length > 50
        ? _messages.sublist(_messages.length - 50)
        : _messages;
    await _chatBox.put('active_messages', messagesToSave);

    if (_messages.length <= 1) {
      return; // Don't save empty/greeting-only chats to SharedPreferences history
    }

    if (_currentSessionId == null) {
      _currentSessionId = DateTime.now().millisecondsSinceEpoch.toString();

      // Generate a title from the first user message
      String title = "New Session";
      final firstUserMsg = _messages.firstWhere(
        (m) => m.isUser,
        orElse: () => _messages[0],
      );
      title = firstUserMsg.text.length > 30
          ? "${firstUserMsg.text.substring(0, 27)}..."
          : firstUserMsg.text;

      final session = ChatSession(
        id: _currentSessionId!,
        title: title,
        messages: List.from(_messages),
        timestamp: DateTime.now(),
        subject: _selectedSubject,
      );
      _history.insert(0, session);
    } else {
      final index = _history.indexWhere((s) => s.id == _currentSessionId);
      if (index != -1) {
        _history[index].messages = List.from(_messages);
      }
    }
    await _saveHistory();
  }

  void deleteSession(String id) async {
    _history.removeWhere((session) => session.id == id);
    if (_currentSessionId == id) {
      // If we deleted the active chat, reset it quietly
      _messages.clear();
      _currentSessionId = null;
      _greetingGenerated = false;
      generateInitialGreeting();
    }
    notifyListeners();
    await _saveHistory();
  }

  /// Clears the current chat and starts a fresh AI session
  void resetChat() async {
    await _updateOrSaveCurrentSession(); // Save to history
    _messages.clear();
    await _chatBox.delete('active_messages'); // Clear Hive active session
    _currentSessionId = null;
    _selectedSubject = null;
    _greetingGenerated = false;
    notifyListeners();
    generateInitialGreeting();
  }

  /// Loads a past session from history
  void loadSession(ChatSession session) {
    _messages.clear();
    _currentSessionId = session.id;
    _messages.addAll(session.messages);
    _selectedSubject = session.subject;
    _greetingGenerated = true; // Prevents re-greeting on load
    notifyListeners();
  }

  // --- PERSISTENCE ---

  Future<void> _loadHistory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final historyStr = prefs.getString('chat_history');
      if (historyStr != null) {
        final List<dynamic> decoded = json.decode(historyStr);
        _history.clear();

        final now = DateTime.now();
        final cutoffDate = now.subtract(const Duration(days: 7));

        bool requiresSave = false;

        for (var jsonMap in decoded) {
          final session = ChatSession.fromJson(jsonMap);
          if (session.timestamp.isAfter(cutoffDate)) {
            _history.add(session);
          } else {
            requiresSave = true; // Pruned an old session
          }
        }

        if (requiresSave) {
          _saveHistory(); // Save the pruned list back to prefs
        }

        notifyListeners();
      }
    } catch (e) {
      debugPrint("Error loading history: $e");
    }
  }

  Future<void> _saveHistory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final historyStr = json.encode(_history.map((s) => s.toJson()).toList());
      await prefs.setString('chat_history', historyStr);
    } catch (e) {
      debugPrint("Error saving history: $e");
    }
  }

  void selectSubject(String subject) {
    // 1. Toggle: If already selected, deselect it
    if (_selectedSubject == subject) {
      _selectedSubject = null;

      // Clean up the switch message if it was the last one added
      if (_messages.isNotEmpty && _messages.last.isSystemSwitch) {
        _messages.removeLast();
      }
      notifyListeners();
      return;
    }

    // 2. Set new subject
    _selectedSubject = subject;

    // 3. Smart Replacement: If the last message was a switch message, replace its text
    if (_messages.isNotEmpty && _messages.last.isSystemSwitch) {
      _messages.last.text = '📘 Switched to **$subject**. Ask me anything!';
    } else {
      _messages.add(
        Message(
          id: 'sys_${DateTime.now()}',
          text: '📘 Switched to **$subject**. Ask me anything!',
          isUser: false,
          isSystemSwitch: true,
        ),
      );
    }
    notifyListeners();
  }

  Map<String, dynamic> _serializeAppContext(AppContext appContext) {
    final metadata = appContext.metadata;
    return {
      'screenType': appContext.screenType.name,
      'timestamp': appContext.timestamp.toIso8601String(),
      if (metadata is CourseMetadata)
        'course': {
          'subjectId': metadata.subjectId,
          'subjectName': metadata.subjectName,
          'moduleNumber': metadata.moduleNumber,
        },
      if (metadata is QuizMetadata)
        'quiz': {'quizId': metadata.quizId, 'quizTitle': metadata.quizTitle},
      if (metadata is GenericMetadata) 'title': metadata.title,
    };
  }

  Future<void> sendMessage(String text, {AppContext? appContext}) async {
    if (text.trim().isEmpty || _isStreaming) return;

    _isStreaming = true;
    _isTyping = true;
    // Prepare history before adding the current user message, so the backend
    // does not receive this prompt twice.
    final formattedHistory = _messages
        .where(
          (m) => !m.id.startsWith("sys_"),
        ) // Exclude system messages from history
        .toList();

    final historyToSend = formattedHistory.length > 6
        ? formattedHistory.sublist(formattedHistory.length - 6)
        : formattedHistory;

    final historyMap = historyToSend
        .map(
          (m) => {'role': m.isUser ? 'user' : 'assistant', 'content': m.text},
        )
        .toList();

    // Add user message to UI.
    _messages.add(
      Message(id: DateTime.now().toString(), text: text, isUser: true),
    );

    notifyListeners();

    await _getAIResponse(
      text,
      historyMap,
      appContext: appContext == null ? null : _serializeAppContext(appContext),
    );
  }

  /// ⚡ Core AI Interaction Engine (Private)
  Future<void> _getAIResponse(
    String question,
    List<Map<String, dynamic>> historyMap, {
    bool isGreeting = false,
    Map<String, dynamic>? appContext,
  }) async {
    String finalQuestion = question;
    if (_selectedSubject != null) {
      finalQuestion = "[Subject: $_selectedSubject] $question";
    }

    Message? assistantMsg;

    try {
      final client = http.Client();
      final request = http.Request('POST', Uri.parse('$_baseUrl/query'));
      request.headers['Content-Type'] = 'application/json';
      request.body = json.encode({
        'question': finalQuestion,
        'subject': _selectedSubject,
        'history': historyMap,
        'studentProfile': _studentProfile, // UPGRADE 2
        ...?appContext == null ? null : {'appContext': appContext},
        if (isGreeting) 'isGreeting': true,
      });

      final response = await client
          .send(request)
          .timeout(const Duration(seconds: 90));

      if (response.statusCode != 200) {
        _isTyping = false;
        _messages.add(
          Message(
            id: 'err_${DateTime.now()}',
            text: 'Something went wrong. Server error.',
            isUser: false,
          ),
        );
        _isStreaming = false;
        notifyListeners();
        return;
      }

      final stream = response.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter());

      await for (final line in stream) {
        final trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          final dataStr = trimmed.substring(6).trim();
          if (dataStr == '[DONE]') {
            // Remove caret on completion
            if (assistantMsg != null) {
              assistantMsg.text = assistantMsg.text.replaceAll(' ▌', '');
            }
            break;
          }

          try {
            final decoded = json.decode(dataStr);
            final choices = decoded['choices'] as List?;

            if (choices != null && choices.isNotEmpty) {
              final delta = choices[0]['delta'];

              // Intercept the custom sources payload directly sent from our backend's SSE payload
              if (delta != null &&
                  delta['sources'] != null &&
                  assistantMsg != null) {
                assistantMsg.sources = List<Map<String, dynamic>>.from(
                  delta['sources'],
                );
                notifyListeners();
                continue;
              }

              final content = delta?['content'];

              if (content != null && content.isNotEmpty) {
                if (assistantMsg == null) {
                  _isTyping = false;
                  assistantMsg = Message(
                    id: 'ai_${DateTime.now()}',
                    text: content + ' ▌',
                    isUser: false,
                  );
                  _messages.add(assistantMsg);
                } else {
                  // Remove old caret, add content, add new caret
                  assistantMsg.text =
                      assistantMsg.text.replaceAll(' ▌', '') + content + ' ▌';
                }

                final now = DateTime.now().millisecondsSinceEpoch;
                if (now - _lastNotifyTime > 40) {
                  // Slightly faster for smoother caret
                  _lastNotifyTime = now;
                  notifyListeners();
                }
              }
            }
          } catch (e) {
            debugPrint("Streaming Error: $e");
          }
        }
      }
      // Final cleanup: ensure caret is gone
      if (assistantMsg != null) {
        assistantMsg.text = assistantMsg.text.replaceAll(' ▌', '');
      }
      _updateOrSaveCurrentSession(); // Automatically save progress to history without explicitly ending chat
      notifyListeners();
    } catch (e) {
      _isTyping = false;
      _messages.add(
        Message(
          id: 'err_${DateTime.now()}',
          text: 'Something went wrong. Try again.',
          isUser: false,
        ),
      );
    } finally {
      _isTyping = false;
      _isStreaming = false;
      notifyListeners();
    }
  }
}

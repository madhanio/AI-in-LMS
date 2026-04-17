import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/message.dart';
import '../models/chat_session.dart';
import '../constants.dart';


class ChatProvider extends ChangeNotifier {
  final List<Message> _messages = [];
  final List<ChatSession> _history = [];
  
  List<String> _subjects = [];
  List<String> _suggestions = [];
  bool _isLoadingSubjects = false;
  bool _isLoadingSuggestions = false;
  String? _selectedSubject;
  bool _isStreaming = false;
  bool _isTyping = false;
  bool _greetingGenerated = false;

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


  ChatProvider() {
    fetchSubjects();
    _loadHistory();
  }

  Future<void> fetchSubjects() async {
    _isLoadingSubjects = true;
    notifyListeners();
    // Also trigger suggestions to load in parallel
    fetchSuggestions();

    try {
      final res = await http.get(Uri.parse('$_baseUrl/subjects')).timeout(const Duration(seconds: 5));
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
      final res = await http.get(Uri.parse('$_baseUrl/prompts')).timeout(const Duration(seconds: 5));
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
        "Give me a quick quiz 🧠"
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
    const prompt = "Introduce yourself as the Academic Mentor. Generate a single, very short, and calm Zen-like professional greeting. Strictly one short line only. Vibe: Specialized LMS Assistant.";
    await _getAIResponse(prompt, []);
  }

  /// 🏛️ ARCHIVE LOGIC: Saves the current session before clearing
  Future<void> _archiveCurrentSession() async {
    if (_messages.length <= 1) return; // Don't save empty/greeting-only chats

    // Generate a title from the first user message
    String title = "New Session";
    final firstUserMsg = _messages.firstWhere((m) => m.isUser, orElse: () => _messages[0]);
    title = firstUserMsg.text.length > 30 
        ? "${firstUserMsg.text.substring(0, 27)}..." 
        : firstUserMsg.text;

    final session = ChatSession(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      title: title,
      messages: List.from(_messages),
      timestamp: DateTime.now(),
      subject: _selectedSubject,
    );

    _history.insert(0, session);
    await _saveHistory();
  }

  /// Clears the current chat and starts a fresh AI session
  void resetChat() async {
    await _archiveCurrentSession();
    _messages.clear();
    _selectedSubject = null;
    _greetingGenerated = false;
    notifyListeners();
    generateInitialGreeting();
  }

  /// Loads a past session from history
  void loadSession(ChatSession session) {
    _messages.clear();
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
        _history.addAll(decoded.map((json) => ChatSession.fromJson(json)).toList());
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
      _messages.add(Message(
        id: 'sys_${DateTime.now()}',
        text: '📘 Switched to **$subject**. Ask me anything!',
        isUser: false,
        isSystemSwitch: true,
      ));
    }
    notifyListeners();
  }

  Future<void> sendMessage(String text) async {
    if (text.trim().isEmpty || _isStreaming) return;

    _isStreaming = true;
    _isTyping = true;
    
    // Add user message to UI
    _messages.add(Message(
      id: DateTime.now().toString(),
      text: text,
      isUser: true,
    ));
    
    notifyListeners();

    // Prepare history
    final formattedHistory = _messages
        .where((m) => !m.id.startsWith("sys_")) // Exclude system messages from history
        .toList();
    
    final historyToSend = formattedHistory.length > 6 
        ? formattedHistory.sublist(formattedHistory.length - 6) 
        : formattedHistory;
        
    final historyMap = historyToSend.map((m) => {
      'role': m.isUser ? 'user' : 'assistant',
      'content': m.text
    }).toList();

    await _getAIResponse(text, historyMap);
  }

  /// ⚡ Core AI Interaction Engine (Private)
  Future<void> _getAIResponse(String question, List<Map<String, dynamic>> historyMap) async {
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
      });

      final response = await client.send(request).timeout(const Duration(seconds: 90));

      if (response.statusCode != 200) {
        _isTyping = false;
        _messages.add(Message(id: 'err_${DateTime.now()}', text: 'Something went wrong. Server error.', isUser: false));
        _isStreaming = false;
        notifyListeners();
        return;
      }

      final stream = response.stream.transform(utf8.decoder).transform(const LineSplitter());

      await for (final line in stream) {
        final trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          final dataStr = trimmed.substring(6).trim();
          if (dataStr == '[DONE]') {
            // Remove caret on completion
            if (assistantMsg != null) {
              assistantMsg!.text = assistantMsg!.text.replaceAll(' ▌', '');
            }
            break;
          }

          try {
            final decoded = json.decode(dataStr);
            final choices = decoded['choices'] as List?;
            
            if (choices != null && choices.isNotEmpty) {
              final delta = choices[0]['delta'];
              final content = delta?['content'];

              if (content != null && content.isNotEmpty) {
                if (assistantMsg == null) {
                  _isTyping = false;
                  assistantMsg = Message(id: 'ai_${DateTime.now()}', text: content + ' ▌', isUser: false);
                  _messages.add(assistantMsg!);
                } else {
                  // Remove old caret, add content, add new caret
                  assistantMsg!.text = assistantMsg!.text.replaceAll(' ▌', '') + content + ' ▌';
                }
                
                final now = DateTime.now().millisecondsSinceEpoch;
                if (now - _lastNotifyTime > 40) { // Slightly faster for smoother caret
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
        assistantMsg!.text = assistantMsg!.text.replaceAll(' ▌', '');
      }
      notifyListeners();
    } catch (e) {
      _isTyping = false;
      _messages.add(Message(id: 'err_${DateTime.now()}', text: 'Something went wrong. Try again.', isUser: false));
    } finally {
      _isTyping = false;
      _isStreaming = false;
      notifyListeners();
    }
  }
}

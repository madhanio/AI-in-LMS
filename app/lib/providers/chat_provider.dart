import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../models/message.dart';

class ChatProvider extends ChangeNotifier {
  final List<Message> _messages = [
    Message(
      id: 'initial',
      text: 'Hello! I am your LMS Assistant. Choose a subject below and let\'s start learning!',
      isUser: false,
    )
  ];
  
  List<String> _subjects = [];
  bool _isLoadingSubjects = false;
  String? _selectedSubject;
  bool _isStreaming = false;
  bool _isTyping = false;
  
  List<Message> get messages => _messages;
  List<String> get subjects => _subjects;
  bool get isLoadingSubjects => _isLoadingSubjects;
  String? get selectedSubject => _selectedSubject;
  bool get isStreaming => _isStreaming;
  bool get isTyping => _isTyping;
  int _lastNotifyTime = 0;

  // Base URL configuration
  final String _baseUrl = 'https://ai-in-lms.onrender.com/api';

  ChatProvider() {
    fetchSubjects();
  }

  Future<void> fetchSubjects() async {
    // Only fetch if we don't have them yet to save time
    if (_subjects.isNotEmpty) return;

    _isLoadingSubjects = true;
    notifyListeners();

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
    
    // Add user message
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

    String finalQuestion = text;
    if (_selectedSubject != null) {
      finalQuestion = "[Subject: $_selectedSubject] $text";
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
          if (dataStr == '[DONE]') break;

          try {
            final decoded = json.decode(dataStr);
            final choices = decoded['choices'] as List?;
            
            if (choices != null && choices.isNotEmpty) {
              final delta = choices[0]['delta'];
              
              // Only display final 'content' (hides the reasoning/thinking logic)
              final content = delta?['content'];

              if (content != null && content.isNotEmpty) {
                if (assistantMsg == null) {
                  _isTyping = false;
                  assistantMsg = Message(id: 'ai_${DateTime.now()}', text: content, isUser: false);
                  _messages.add(assistantMsg);
                } else {
                  assistantMsg.text += content;
                }
                
                // PERFORMANCE FIX: Only update UI every few chunks to prevent lagging
                final now = DateTime.now().millisecondsSinceEpoch;
                if (now - _lastNotifyTime > 50) { // Update every 50ms
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
      // Ensure the final chunk is always rendered
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

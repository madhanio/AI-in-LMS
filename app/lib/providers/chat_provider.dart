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
  String? _selectedSubject;
  bool _isStreaming = false;
  
  List<Message> get messages => _messages;
  List<String> get subjects => _subjects;
  String? get selectedSubject => _selectedSubject;
  bool get isStreaming => _isStreaming;

  // Base URL configuration
  final String _baseUrl = 'https://ai-in-lms.onrender.com/api';

  ChatProvider() {
    fetchSubjects();
  }

  Future<void> fetchSubjects() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/subjects'));
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        _subjects = List<String>.from(data['subjects']);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error fetching subjects: $e');
    }
  }

  void selectSubject(String subject) {
    if (_selectedSubject == subject) return;
    
    _selectedSubject = subject;
    // (b) Immediately add an assistant message
    _messages.add(Message(
      id: DateTime.now().toString(),
      text: '📘 Switched to **$subject**. Ask me anything!',
      isUser: false,
    ));
    notifyListeners();
  }

  Future<void> sendMessage(String text) async {
    if (text.trim().isEmpty || _isStreaming) return;

    // Add user message
    final userMsg = Message(
      id: DateTime.now().toString(),
      text: text,
      isUser: true,
    );
    _messages.add(userMsg);
    
    // Add placeholder assistant message for streaming
    final assistantMsg = Message(
      id: 'stream_${DateTime.now()}',
      text: '',
      isUser: false,
    );
    _messages.add(assistantMsg);
    
    _isStreaming = true;
    notifyListeners();

    // Prepare history (last 6 messages / 3 pairs)
    final history = _messages
        .take(_messages.length - 2) // exclude the current pair
        .toList();
    
    final recentHistory = history.length > 6 
        ? history.sublist(history.length - 6) 
        : history;
        
    final formattedHistory = recentHistory.map((m) => {
      'role': m.isUser ? 'user' : 'assistant',
      'content': m.text
    }).toList();

    // (c) Prepend subject context if selected
    String finalQuestion = text;
    if (_selectedSubject != null) {
      finalQuestion = "[Subject: $_selectedSubject] $text";
    }

    try {
      final client = http.Client();
      final request = http.Request('POST', Uri.parse('$_baseUrl/query'));
      request.headers['Content-Type'] = 'application/json';
      request.body = json.encode({
        'question': finalQuestion,
        'subject': _selectedSubject,
        'history': formattedHistory,
      });

      final response = await client.send(request).timeout(const Duration(seconds: 30));

      if (response.statusCode != 200) {
        assistantMsg.text = 'Something went wrong. Server error: ${response.statusCode}';
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
          if (dataStr == '[DONE]') break;

          try {
            final decoded = json.decode(dataStr);
            final content = decoded['choices']?[0]['delta']?['content'];
            if (content != null) {
              assistantMsg.text += content;
              notifyListeners();
            }
          } catch (e) {
            // Skip malformed chunks
          }
        }
      }
    } catch (e) {
      assistantMsg.text = 'Something went wrong. Try again.';
      debugPrint('Streaming Error: $e');
    } finally {
      _isStreaming = false;
      notifyListeners();
    }
  }
}

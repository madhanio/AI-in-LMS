import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class AiChatScreen extends StatefulWidget {
  const AiChatScreen({super.key});

  @override
  State<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends State<AiChatScreen> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  
  List<String> _subjects = [];
  String? _selectedSubject;
  bool _isAILoading = false;
  
  final List<Map<String, String>> _messages = [
    {
      'role': 'ai',
      'text': 'Hello! I am your LMS Assistant. Choose a subject below and let\'s start learning!'
    }
  ];

  @override
  void initState() {
    super.initState();
    _fetchSubjects();
  }

  Future<void> _fetchSubjects() async {
    try {
      final res = await http.get(Uri.parse('$_baseUrl/subjects'));
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        if (mounted) {
          setState(() {
            _subjects = List<String>.from(data['subjects']);
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching subjects: $e');
    }
  }

  String get _baseUrl {
    const String productionUrl = 'https://ai-in-lms.onrender.com/api'; 
    return productionUrl;
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _addMessage(String text, String role) {
    setState(() {
      _messages.add({'role': role, 'text': text});
    });
    _scrollToBottom();
  }

  void _updateLastMessage(String chunk) {
    setState(() {
      if (_messages.isNotEmpty && _messages.last['role'] == 'ai') {
        _messages.last['text'] = (_messages.last['text'] ?? '') + chunk;
      } else {
        _messages.add({'role': 'ai', 'text': chunk});
      }
    });
    _scrollToBottom();
  }

  Future<void> _sendMessage() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    _addMessage(text, 'user');
    _controller.clear();
    setState(() => _isAILoading = true);

    // Format history: extract last 6 messages (3 pairs) excluding the current user message
    final historyMessages = _messages.take(_messages.length - 1).toList();
    final recentHistory = historyMessages.length > 6 
        ? historyMessages.skip(historyMessages.length - 6).toList() 
        : historyMessages;
        
    final formattedHistory = recentHistory.map((m) => {
      'role': m['role'] == 'ai' ? 'assistant' : 'user', // Gemma expects 'assistant' or 'user'
      'content': m['text']
    }).toList();

    http.StreamedResponse? response;
    http.Client? activeClient;
    int retries = 0;

    while (retries < 3) {
      try {
        activeClient = http.Client();
        final request = http.Request('POST', Uri.parse('$_baseUrl/query'));
        request.headers['Content-Type'] = 'application/json';
        request.body = json.encode({
          'question': text,
          'subject': _selectedSubject,
          'history': formattedHistory,
        });

        response = await activeClient.send(request).timeout(const Duration(seconds: 30));

        if (response.statusCode == 200) {
          break; // Success
        } else {
          activeClient.close();
          retries++;
        }
      } catch (e) {
        activeClient?.close();
        retries++;
        if (retries >= 3) {
          if (!mounted) return;
          setState(() => _isAILoading = false);
          _addMessage('Connection failed after 3 retries: $e', 'ai');
          return;
        }
        // Exponential backoff: 2s, 4s
        await Future.delayed(Duration(seconds: 1 << retries));
      }
    }

    if (response == null || response.statusCode != 200) {
      if (!mounted) return;
      setState(() => _isAILoading = false);
      _addMessage('Server Error: Failed to connect.', 'ai');
      return;
    }

    try {
      // Start parsing the stream
      bool firstChunk = true;

      response.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen((line) {
        if (!mounted) return;
        if (line.trim().startsWith('data: ')) {
          final dataStr = line.trim().substring(6).trim();
          if (dataStr == '[DONE]') return;

          try {
            final decoded = json.decode(dataStr);
            final content = decoded['choices']?[0]['delta']?['content'];
            if (content != null) {
              if (firstChunk) {
                setState(() => _isAILoading = false);
                _addMessage('', 'ai'); // Create empty bubble
                firstChunk = false;
              }
              _updateLastMessage(content);
            }
          } catch (e) {
            // Ignore malformed chunks
          }
        }
      }, onDone: () {
        if (!mounted) return;
        activeClient?.close();
        if (firstChunk) {
          setState(() => _isAILoading = false);
          _addMessage('No response generated.', 'ai');
        }
      }, onError: (e) {
        if (!mounted) return;
        activeClient?.close();
        setState(() => _isAILoading = false);
        if (firstChunk) {
           _addMessage('Connection interrupted. Please retry.', 'ai');
        } else {
           _updateLastMessage('\n\n[Connection interrupted. Please retry.]');
        }
      });
    } catch (e) {
      if (!mounted) return;
      activeClient?.close();
      setState(() => _isAILoading = false);
      _addMessage('Connection failed: $e', 'ai');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7F9),
      appBar: AppBar(
        title: const Text('Academic Mentor', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
        centerTitle: true,
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: Colors.grey.shade200, height: 1),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
              itemCount: _messages.length + (_isAILoading ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == _messages.length) {
                  return const Align(alignment: Alignment.centerLeft, child: _TypingIndicator());
                }

                final msg = _messages[index];
                final isUser = msg['role'] == 'user';
                final isSystem = msg['role'] == 'system';

                if (isSystem) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Center(child: Text(msg['text']!, style: const TextStyle(color: Colors.grey, fontSize: 13))),
                  );
                }

                return Align(
                  alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isUser ? const Color(0xFFF98012) : Colors.white,
                      borderRadius: BorderRadius.circular(24).copyWith(
                        bottomRight: isUser ? const Radius.circular(0) : const Radius.circular(24),
                        bottomLeft: !isUser ? const Radius.circular(0) : const Radius.circular(24),
                      ),
                      boxShadow: [
                        BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 4)),
                      ],
                    ),
                    constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
                    child: Text(
                      msg['text']!,
                      style: TextStyle(color: isUser ? Colors.white : Colors.black87, fontSize: 15, height: 1.4),
                    ),
                  ),
                );
              },
            ),
          ),
          
          // Bottom Area with Subject Chips & Input
          Container(
            padding: const EdgeInsets.only(bottom: 20, left: 16, right: 16),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, -2))],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 12),
                // Compact horizontal subject selector
                SizedBox(
                  height: 36,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: _subjects.length,
                    itemBuilder: (context, idx) {
                      final sub = _subjects[idx];
                      final isSelected = _selectedSubject == sub;
                      final shortName = sub.split('(').last.replaceAll(')', '');
                      
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(shortName, style: const TextStyle(fontSize: 12)),
                          selected: isSelected,
                          onSelected: (val) => setState(() => _selectedSubject = val ? sub : null),
                          selectedColor: const Color(0xFFF98012),
                          backgroundColor: Colors.grey.shade100,
                          labelStyle: TextStyle(color: isSelected ? Colors.white : Colors.black87),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        decoration: InputDecoration(
                          hintText: 'Ask your tutor...',
                          filled: true,
                          fillColor: const Color(0xFFF8F9FA),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: BorderSide.none),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                        ),
                        onSubmitted: (_) => _sendMessage(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    CircleAvatar(
                      backgroundColor: const Color(0xFFF98012),
                      radius: 26,
                      child: IconButton(icon: const Icon(Icons.send_rounded, color: Colors.white), onPressed: _sendMessage),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TypingIndicator extends StatefulWidget {
  const _TypingIndicator();
  @override
  _TypingIndicatorState createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<_TypingIndicator> with TickerProviderStateMixin {
  late AnimationController _controller;
  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000))..repeat();
  }
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24)),
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return Row(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(3, (index) {
              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 2),
                height: 8, width: 8,
                decoration: BoxDecoration(
                  color: Color.lerp(Colors.grey.shade300, const Color(0xFFF98012), 
                    ( (_controller.value + (index * 0.2)) % 1.0 ).clamp(0.0, 1.0)
                  ),
                  shape: BoxShape.circle,
                ),
              );
            }),
          );
        },
      ),
    );
  }
}



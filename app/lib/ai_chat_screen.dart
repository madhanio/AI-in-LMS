import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'providers/chat_provider.dart';
import 'widgets/message_bubble.dart';
import 'widgets/typing_indicator.dart';
import 'widgets/subject_chip_row.dart';
import 'widgets/input_bar.dart';
import 'widgets/suggestion_cards.dart';
import 'widgets/history_drawer.dart';

class AiChatScreen extends StatefulWidget {
  const AiChatScreen({super.key});

  @override
  State<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends State<AiChatScreen> {
  final ScrollController _scrollController = ScrollController();
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final TextEditingController _suggestionController = TextEditingController();

  final Map<String, List<String>> _subjectSuggestions = {
    "CN": ["Explain OSI Model", "Quiz me on TCP/IP", "Summarize Unit 3"],
    "DS": ["Explain overfitting", "What is a confusion matrix?", "Explain linear regression"],
    "SE": ["Explain SDLC models", "What is UML?", "Describe Agile sprint"],
    "OS": ["What is deadlock?", "Explain page replacement", "CPU scheduling algorithms"],
  };

  @override
  void initState() {
    super.initState();
    // 🚀 FRESH START: Fetch subjects and generate a unique AI greeting on open
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final chatProvider = Provider.of<ChatProvider>(context, listen: false);
      chatProvider.fetchSubjects();
      
      // Only generate a greeting if this is a fresh start (empty chat)
      if (chatProvider.messages.isEmpty) {
        chatProvider.generateInitialGreeting();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _suggestionController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      final maxScroll = _scrollController.position.maxScrollExtent;
      final currentScroll = _scrollController.position.pixels;
      
      // Only force scroll down if the user is ALREADY near the bottom
      if (maxScroll - currentScroll <= 150) {
        _scrollController.animateTo(
          maxScroll,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFFFEFDFB),
      drawer: const HistoryDrawer(),
      appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.menu, color: Color(0xFF1C1C1E), size: 22),
            onPressed: () => _scaffoldKey.currentState?.openDrawer(),
          ),
          title: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.school, color: Color(0xFFF98012), size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Academic Mentor',
                    style: GoogleFonts.inter(
                      color: const Color(0xFF1C1C1E),
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                ],
              ),
              Text(
                'AI powered Syllabus Expert',
                style: GoogleFonts.inter(
                  color: Colors.grey.shade500,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          centerTitle: true,
          actions: [
            IconButton(
              tooltip: 'New Chat',
              icon: const Icon(Icons.add_circle_outline, color: Color(0xFF1C1C1E), size: 22),
              onPressed: () => context.read<ChatProvider>().resetChat(),
            ),
            const SizedBox(width: 8),
          ],
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(1),
            child: Container(color: Colors.grey.shade200, height: 1),
          ),
        ),
        body: SafeArea(
          child: Consumer<ChatProvider>(
            builder: (context, chatProvider, child) {
              // Trigger scroll on any message change or streaming chunk
              WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());

              final messages = chatProvider.messages;
              final isTyping = chatProvider.isTyping;
              // 🧠 SMART UI: Only show suggestions for first-time rookies (Empty Messages + Empty History)
              final showSuggestions = messages.isEmpty && chatProvider.history.isEmpty && !isTyping;
              final extraWidgets = (isTyping ? 1 : 0) + (showSuggestions ? 1 : 0);

              return Column(
                children: [
                  const SubjectChipRow(),
                  Expanded(
                    child: ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                      itemCount: messages.length + extraWidgets,
                      itemBuilder: (context, index) {
                        // ✨ EMPTY STATE: Fill the 'Grey Void' with helpful context
                        if (messages.isEmpty && !isTyping) {
                           return Container(
                             height: MediaQuery.of(context).size.height * 0.5,
                             alignment: Alignment.center,
                             child: Column(
                               mainAxisAlignment: MainAxisAlignment.center,
                               children: [
                                 Container(
                                   padding: const EdgeInsets.all(24),
                                   decoration: BoxDecoration(
                                     color: const Color(0xFFF98012).withOpacity(0.05),
                                     shape: BoxShape.circle,
                                   ),
                                   child: const Icon(Icons.auto_stories_outlined, size: 64, color: Color(0xFFF98012)),
                                 ),
                                 const SizedBox(height: 24),
                                 Text(
                                   'Ask anything from your syllabus',
                                   style: GoogleFonts.inter(
                                     fontSize: 18,
                                     fontWeight: FontWeight.w600,
                                     color: const Color(0xFF1C1C1E),
                                   ),
                                 ),
                                 const SizedBox(height: 8),
                                 Text(
                                   'Get instant answers, summaries, and exam tips',
                                   style: GoogleFonts.inter(
                                     fontSize: 14,
                                     color: Colors.grey.shade500,
                                   ),
                                 ),
                               ],
                             ),
                           );
                        }

                        if (index < messages.length) {
                          return MessageBubble(message: messages[index]);
                        }
                        
                        // Extra widgets (Typing or Suggestions)
                        if (isTyping && index == messages.length) {
                          return const TypingIndicator();
                        }

                        if (showSuggestions) {
                          return SuggestionCards(
                            onSelect: (prompt) => chatProvider.sendMessage(prompt),
                          );
                        }

                        return const SizedBox.shrink();
                      },
                    ),
                  ),
                  _buildSuggestionChips(chatProvider),
                  InputBar(controller: _suggestionController),
                ],
              );
            },
          ),
        ),
        resizeToAvoidBottomInset: true,
      );
  }

  Widget _buildSuggestionChips(ChatProvider chatProvider) {
    String? currentKey;
    if (chatProvider.selectedSubject != null) {
      final parts = chatProvider.selectedSubject!.split('(');
      if (parts.length > 1) {
        currentKey = parts.last.replaceAll(')', '');
      }
    }

    final suggestions = _subjectSuggestions[currentKey] ?? [];
    if (suggestions.isEmpty) return const SizedBox.shrink();

    return Container(
      height: 48,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: suggestions.map((text) {
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: InkWell(
                onTap: () {
                  _suggestionController.text = text;
                  chatProvider.sendMessage(text);
                  _suggestionController.clear();
                },
                borderRadius: BorderRadius.circular(99),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(99),
                    border: Border.all(color: Colors.grey.shade700, width: 0.5),
                    color: Colors.transparent,
                  ),
                  child: Text(
                    text,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: Colors.grey.shade400,
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

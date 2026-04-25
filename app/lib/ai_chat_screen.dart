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
    "__general__": ["What's on my study schedule? 📅", "Summarize my syllabus 📄", "Give me an exam tip 💡", "How many modules in total? 📚"],
    "CN": ["Explain OSI Model Layers", "Quiz me on TCP/UDP", "Summarize Unit 3"],
    "DS": ["Explain Data Structures", "What is Big O?", "Summarize Module 2"],
    "SE": ["What is SDLC?", "Explain UML Diagrams", "Agile vs Waterfall"],
    "OS": ["What is Deadlock?", "Explain Paging", "CPU Scheduling Quiz"],
    "OOPJ": ["Explain Java Inheritance", "What are JVM, JRE, JDK?", "Encapsulation vs Abstraction"],
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
                    'AcademicCore',
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
              // 🧠 SMART UI: Only show suggestion CARDS for first-run empty void
              final showSuggestionCards = messages.isEmpty && chatProvider.history.isEmpty && !isTyping;
              final extraWidgets = (isTyping ? 1 : 0) + (showSuggestionCards ? 1 : 0);

              return Column(
                children: [
                  const SubjectChipRow(),
                  Expanded(
                    child: ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                      itemCount: messages.length + extraWidgets,
                      itemBuilder: (context, index) {
                        if (index < messages.length) {
                          final bubble = MessageBubble(message: messages[index]);
                          
                          // If this is the welcome message (index 0) and we have no other history
                          // inject the empty state illustration right below it
                          if (index == 0 && messages.length <= 1 && !isTyping) {
                             return Column(
                               children: [
                                 bubble,
                                 const SizedBox(height: 40),
                                 _buildEmptyState(chatProvider.selectedSubject),
                               ],
                             );
                          }
                          return bubble;
                        }
                        
                        // Extra widgets (Typing or Suggestions)
                        if (isTyping && index == messages.length) {
                          return const TypingIndicator();
                        }

                        if (showSuggestionCards) {
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

  Widget _buildEmptyState(String? subject) {
    return Center(
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.grey.withOpacity(0.04),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.auto_awesome_outlined, size: 40, color: Colors.grey.shade400),
          ),
          const SizedBox(height: 16),
          Text(
            subject != null ? 'Ask anything about $subject 📚' : 'Select a subject to start learning 🎓',
            style: GoogleFonts.inter(
              fontSize: 14,
              color: Colors.grey.shade500,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuggestionChips(ChatProvider chatProvider) {
    List<String> suggestions = [];
    
    if (chatProvider.selectedSubject != null) {
      // Find matching subject key (e.g., from "Operating Systems (OS)" -> "OS")
      String currentKey = "";
      final parts = chatProvider.selectedSubject!.split('(');
      if (parts.length > 1) {
        currentKey = parts.last.replaceAll(')', '').trim();
      } else {
        currentKey = chatProvider.selectedSubject!.trim();
      }
      suggestions = _subjectSuggestions[currentKey] ?? [];
    } else {
      // General suggestions when no subject is selected
      suggestions = _subjectSuggestions["__general__"] ?? [];
    }

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
                  chatProvider.sendMessage(text);
                },
                borderRadius: BorderRadius.circular(99),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(99),
                    border: Border.all(color: Colors.grey.shade200, width: 1),
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.02),
                        blurRadius: 4,
                      )
                    ]
                  ),
                  child: Text(
                    text,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey.shade600,
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

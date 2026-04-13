import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'providers/chat_provider.dart';
import 'widgets/message_bubble.dart';
import 'widgets/typing_indicator.dart';
import 'widgets/subject_chip_row.dart';
import 'widgets/input_bar.dart';
import 'widgets/suggestion_cards.dart';

class AiChatScreen extends StatefulWidget {
  const AiChatScreen({super.key});

  @override
  State<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends State<AiChatScreen> {
  final ScrollController _scrollController = ScrollController();

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
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF1C1C1E), size: 18),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(
             'Academic Mentor',
             style: GoogleFonts.inter(
               color: const Color(0xFF1C1C1E),
               fontWeight: FontWeight.w700,
               fontSize: 18,
             ),
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
              final showSuggestions = messages.length <= 1 && !isTyping;
              final extraWidgets = (isTyping ? 1 : 0) + (showSuggestions ? 1 : 0);

              return Column(
                children: [
                  Expanded(
                    child: ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                      itemCount: messages.length + extraWidgets,
                      itemBuilder: (context, index) {
                        if (index < messages.length) {
                          return MessageBubble(message: messages[index]);
                        }
                        
                        // Extra widgets (Typing or Suggestions)
                        if (isTyping && index == messages.length) {
                          return const Row(
                            mainAxisAlignment: MainAxisAlignment.start,
                            children: [TypingIndicator()],
                          );
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
                  const SubjectChipRow(),
                  const InputBar(),
                ],
              );
            },
          ),
        ),
        resizeToAvoidBottomInset: true,
      );
  }
}

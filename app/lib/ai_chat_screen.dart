import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'providers/chat_provider.dart';
import 'widgets/message_bubble.dart';
import 'widgets/typing_indicator.dart';
import 'widgets/subject_chip_row.dart';
import 'widgets/input_bar.dart';

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
    // Auto-scroll listener handled in build/didUpdateWidget or via Provider notifications
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
              final isStreaming = chatProvider.isStreaming;
              final showTyping = isStreaming && messages.isNotEmpty && messages.last.text.isEmpty;

              return Column(
                children: [
                  Expanded(
                    child: ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                      itemCount: messages.length + (showTyping ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index == messages.length) {
                          return const TypingIndicator();
                        }
                        return MessageBubble(message: messages[index]);
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

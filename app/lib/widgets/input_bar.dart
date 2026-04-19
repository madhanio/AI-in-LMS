import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/chat_provider.dart';

class InputBar extends StatefulWidget {
  const InputBar({super.key});

  @override
  State<InputBar> createState() => _InputBarState();
}

class _InputBarState extends State<InputBar> {
  final TextEditingController _controller = TextEditingController();

  void _handleSend(ChatProvider provider) {
    final text = _controller.text.trim();
    if (text.isNotEmpty) {
      provider.sendMessage(text);
      _controller.clear();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final chatProvider = context.watch<ChatProvider>();
    final isStreaming = chatProvider.isStreaming;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
        border: Border(top: BorderSide(color: Colors.grey.shade100)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _controller,
              enabled: !isStreaming,
              style: GoogleFonts.inter(fontSize: 15, color: const Color(0xFF1C1C1E)),
              decoration: InputDecoration(
                hintText: isStreaming ? 'Mentor is thinking...' : 'Ask your tutor...',
                hintStyle: GoogleFonts.inter(fontSize: 15, color: Colors.grey.shade400),
                filled: true,
                fillColor: const Color(0xFFF5F5F7),
                contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(30),
                  borderSide: BorderSide.none,
                ),
              ),
              onSubmitted: (_) => _handleSend(chatProvider),
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: isStreaming ? null : () => _handleSend(chatProvider),
            child: CircleAvatar(
              backgroundColor: isStreaming ? Colors.grey.shade300 : const Color(0xFFFF8C00),
              radius: 24,
              child: Icon(
                Icons.send_rounded,
                color: isStreaming ? Colors.grey.shade100 : Colors.white,
                size: 20,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:intl/intl.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/message.dart';

class MessageBubble extends StatelessWidget {
  final Message message;

  const MessageBubble({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: message.isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!message.isUser)
            Padding(
              padding: const EdgeInsets.only(top: 8, right: 8),
              child: CircleAvatar(
                radius: 16,
                backgroundColor: const Color(0xFFF98012).withOpacity(0.1),
                child: const Icon(Icons.school_outlined, size: 18, color: Color(0xFFF98012)),
              ),
            ),
          Flexible(
            child: Column(
              crossAxisAlignment: message.isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                if (!message.isUser)
                  Padding(
                    padding: const EdgeInsets.only(left: 4, bottom: 4),
                    child: Text(
                      'Academic Mentor',
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Colors.grey.shade500,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                Container(
                  margin: const EdgeInsets.symmetric(vertical: 2),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.75,
                  ),
                  decoration: BoxDecoration(
                    color: message.isUser ? const Color(0xFFFF8C00) : const Color(0xFFFFFFFF),
                    gradient: message.isUser 
                      ? const LinearGradient(
                          colors: [Color(0xFFFF8C00), Color(0xFFFFA500)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : null,
                    border: !message.isUser 
                      ? const Border(left: BorderSide(color: Color(0xFFF98012), width: 3))
                      : null,
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(message.isUser ? 20 : 4),
                      topRight: const Radius.circular(20),
                      bottomLeft: Radius.circular(message.isUser ? 20 : 20),
                      bottomRight: Radius.circular(message.isUser ? 4 : 20),
                    ),
                    boxShadow: [
                      if (!message.isUser)
                        BoxShadow(
                          color: Colors.black.withOpacity(0.05),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                    ],
                  ),
                  child: message.isUser
                    ? Text(
                        message.text,
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                        ),
                      )
                    : MarkdownBody(
                        data: message.text,
                        styleSheet: MarkdownStyleSheet(
                          h3: GoogleFonts.inter(
                            color: const Color(0xFFFF8C00),
                            fontWeight: FontWeight.w700,
                          ),
                          strong: GoogleFonts.inter(
                            color: const Color(0xFF1C1C1E),
                            fontWeight: FontWeight.w600,
                          ),
                          p: GoogleFonts.inter(
                            color: const Color(0xFF3C3C43),
                            fontSize: 15,
                            height: 1.6,
                          ),
                        ),
                      ),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 4, left: 4, right: 4),
                  child: Text(
                    DateFormat('hh:mm a').format(message.createdAt),
                    style: GoogleFonts.inter(
                      color: Colors.grey.shade400,
                      fontSize: 10,
                    ),
                  ),
                ),
                if (!message.isUser && message.sources != null && message.sources!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8, left: 0, right: 4),
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: message.sources!.map((s) {
                        final fileName = (s['name'] ?? 'Document').toLowerCase();
                        final isWord = fileName.endsWith('.doc') || fileName.endsWith('.docx');
                        
                        return GestureDetector(
                          onTap: () async {
                            final url = s['url'];
                            if (url != null) {
                              try {
                                final uri = Uri.parse(url);
                                await launchUrl(uri, mode: LaunchMode.externalApplication);
                              } catch (_) {}
                            }
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: Colors.grey.shade200),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  isWord ? Icons.description_outlined : Icons.picture_as_pdf_outlined, 
                                  size: 12, 
                                  color: Colors.grey.shade600
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  "Source: ${s['name'] ?? 'Note'}",
                                  style: GoogleFonts.inter(
                                    fontSize: 10, 
                                    fontWeight: FontWeight.w500, 
                                    color: Colors.grey.shade700
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

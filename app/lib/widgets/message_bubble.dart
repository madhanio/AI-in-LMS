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
      child: Column(
        crossAxisAlignment: message.isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 4),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.75,
            ),
            decoration: BoxDecoration(
              color: message.isUser ? const Color(0xFFFF8C00) : Colors.white,
              gradient: message.isUser 
                ? const LinearGradient(
                    colors: [Color(0xFFFF8C00), Color(0xFFFFA500)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : null,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(20),
                topRight: const Radius.circular(20),
                bottomLeft: Radius.circular(message.isUser ? 20 : 0),
                bottomRight: Radius.circular(message.isUser ? 0 : 20),
              ),
              boxShadow: [
                if (!message.isUser)
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
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
            padding: const EdgeInsets.only(bottom: 12, left: 4, right: 4),
            child: Text(
              DateFormat('hh:mm a').format(message.createdAt),
              style: GoogleFonts.inter(
                color: Colors.grey.shade500,
                fontSize: 11,
              ),
            ),
          ),
          if (!message.isUser && message.sources != null && message.sources!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12, left: 4, right: 4),
              child: Wrap(
                spacing: 8,
                runSpacing: 4,
                children: message.sources!.map((s) {
                  return ActionChip(
                    avatar: const Icon(Icons.picture_as_pdf, size: 14, color: Color(0xFFFF8C00)),
                    label: Text(
                      s['name'] ?? 'Document',
                      style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: const Color(0xFF1C1C1E)),
                    ),
                    backgroundColor: Colors.white,
                    side: BorderSide(color: Colors.grey.shade200),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    elevation: 0,
                    onPressed: () async {
                      final url = s['url'];
                      if (url != null) {
                        final uri = Uri.parse(url);
                        if (await canLaunchUrl(uri)) {
                          await launchUrl(uri, mode: LaunchMode.externalApplication);
                        }
                      }
                    },
                  );
                }).toList(),
              ),
            ),
        ],
      ),
    );
  }
}

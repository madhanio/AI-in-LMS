import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:intl/intl.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:provider/provider.dart';
import '../models/message.dart';
import '../models/app_context.dart';
import '../providers/app_context_provider.dart';

class MessageBubble extends StatefulWidget {
  final Message message;

  const MessageBubble({super.key, required this.message});

  @override
  State<MessageBubble> createState() => _MessageBubbleState();
}

class _MessageBubbleState extends State<MessageBubble> {
  bool _showTimestamp = false;

  void _toggleTimestamp() {
    setState(() {
      _showTimestamp = !_showTimestamp;
    });
  }

  @override
  Widget build(BuildContext context) {
    final message = widget.message;
    if (message.isSystemSwitch) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3E0),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFFE0B2), width: 0.5),
            ),
            child: Text(
              message.text.replaceAll('📘 ', '').replaceAll('**', ''),
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 11,
                color: const Color(0xFFE65100),
                fontWeight: FontWeight.w700,
                letterSpacing: 0.2,
              ),
            ),
          ),
        ),
      );
    }

    return Padding(
      // Keep chat turns visually connected; list builders add any extra gap.
      padding: EdgeInsets.only(top: message.isUser ? 0 : 1, bottom: 0),
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(begin: 0.0, end: 1.0),
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutQuart,
        builder: (context, value, child) => Transform.translate(
          offset: Offset(
            message.isUser ? 20 * (1 - value) : -20 * (1 - value),
            10 * (1 - value),
          ),
          child: Opacity(opacity: value, child: child),
        ),
        child: Align(
          alignment: message.isUser
              ? Alignment.centerRight
              : Alignment.centerLeft,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!message.isUser)
                Padding(
                  padding: const EdgeInsets.only(top: 4, right: 8),
                  child: CircleAvatar(
                    radius: 16,
                    backgroundColor: const Color(
                      0xFFF98012,
                    ).withValues(alpha: 0.1),
                    child: const Icon(
                      Icons.school_outlined,
                      size: 18,
                      color: Color(0xFFF98012),
                    ),
                  ),
                ),
              Flexible(
                child: Column(
                  crossAxisAlignment: message.isUser
                      ? CrossAxisAlignment.end
                      : CrossAxisAlignment.start,
                  children: [
                    if (!message.isUser)
                      Padding(
                        padding: const EdgeInsets.only(left: 4, bottom: 2),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'AcademicCore',
                              style: GoogleFonts.inter(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: Colors.grey.shade700,
                                letterSpacing: 0.2,
                              ),
                            ),
                            const SizedBox(width: 8),
                            // Contextual Topic Pill
                            Consumer<AppContextProvider>(
                              builder: (context, provider, child) {
                                final appContext = provider.currentContext;
                                String? topic;
                                if (appContext.metadata is CourseMetadata) {
                                  topic =
                                      (appContext.metadata as CourseMetadata)
                                          .subjectName;
                                } else if (appContext.metadata
                                    is QuizMetadata) {
                                  topic = (appContext.metadata as QuizMetadata)
                                      .quizTitle;
                                }

                                if (topic == null || topic.isEmpty) {
                                  return const SizedBox.shrink();
                                }

                                return Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade200,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    topic,
                                    style: GoogleFonts.inter(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.grey.shade600,
                                    ),
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                    GestureDetector(
                      onTap: _toggleTimestamp,
                      child: Container(
                        // Removed tight 2px margin for cleaner spacing
                        margin: EdgeInsets.zero,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        constraints: BoxConstraints(
                          maxWidth:
                              MediaQuery.of(context).size.width *
                              (message.isUser ? 0.75 : 0.78),
                        ),
                        decoration: BoxDecoration(
                          color: message.isUser
                              ? const Color(0xFFFF8C00)
                              : Colors.white,
                          gradient: message.isUser
                              ? const LinearGradient(
                                  colors: [
                                    Color(0xFFFF8C00),
                                    Color(0xFFFFA500),
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                )
                              : null,
                          border: !message.isUser
                              ? Border.all(
                                  color: Colors.grey.shade200,
                                  width: 1,
                                )
                              : null,
                          borderRadius: BorderRadius.only(
                            topLeft: Radius.circular(message.isUser ? 20 : 4),
                            topRight: const Radius.circular(20),
                            bottomLeft: const Radius.circular(20),
                            bottomRight: Radius.circular(
                              message.isUser ? 0 : 20,
                            ),
                          ),
                          boxShadow: [
                            if (!message.isUser)
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.04),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                          ],
                        ),
                        child: SelectionArea(
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
                      ),
                    ),
                    if (_showTimestamp)
                      Padding(
                        padding: const EdgeInsets.only(
                          bottom: 8,
                          top: 4,
                          left: 4,
                          right: 4,
                        ),
                        child: Text(
                          DateFormat('hh:mm a').format(message.createdAt),
                          style: GoogleFonts.inter(
                            color: Colors.grey.shade400,
                            fontSize: 10,
                          ),
                        ),
                      ),
                    if (!message.isUser &&
                        message.sources != null &&
                        message.sources!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(
                          bottom: 8,
                          left: 0,
                          right: 4,
                          top: 8,
                        ),
                        child: Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: message.sources!.map((s) {
                            final fileName = (s['name'] ?? 'Document')
                                .toLowerCase();
                            final isWord =
                                fileName.endsWith('.doc') ||
                                fileName.endsWith('.docx');

                            return GestureDetector(
                              onTap: () async {
                                final url = s['url'];
                                if (url != null) {
                                  try {
                                    final uri = Uri.parse(url);
                                    await launchUrl(
                                      uri,
                                      mode: LaunchMode.externalApplication,
                                    );
                                  } catch (_) {}
                                }
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(
                                    color: Colors.grey.shade200,
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      isWord
                                          ? Icons.description_outlined
                                          : Icons.picture_as_pdf_outlined,
                                      size: 12,
                                      color: Colors.grey.shade600,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      "Source: ${s['name'] ?? 'Note'}",
                                      style: GoogleFonts.inter(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w500,
                                        color: Colors.grey.shade700,
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
        ),
      ),
    );
  }
}

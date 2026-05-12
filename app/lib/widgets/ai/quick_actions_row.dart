import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../providers/app_context_provider.dart';
import '../../providers/chat_provider.dart';
import '../../models/app_context.dart';

class QuickActionsRow extends StatelessWidget {
  const QuickActionsRow({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AppContextProvider>(
      builder: (context, contextProvider, child) {
        final appContext = contextProvider.currentContext;
        
        List<({String label, String prompt})> actions = [];

        switch (appContext.screenType) {
          case ScreenType.dashboard:
            actions = [
              (label: "📅 My schedule", prompt: "What's my schedule for today?"),
              (label: "📝 Pending work", prompt: "Summarize my pending assignments and tasks"),
              (label: "📣 Announcements", prompt: "Show me any recent announcements"),
            ];
            break;
          case ScreenType.courseDetails:
            final subject = appContext.metadata is CourseMetadata
                ? (appContext.metadata as CourseMetadata).subjectName
                : "this subject";
            actions = [
              (label: "📖 Summarize", prompt: "Summarize the key topics in $subject"),
              (label: "💡 Explain concept", prompt: "Explain the core concepts of $subject"),
              (label: "🧪 Practice questions", prompt: "Give me practice questions for $subject"),
            ];
            break;
          case ScreenType.quiz:
            final quizTitle = appContext.metadata is QuizMetadata
                ? (appContext.metadata as QuizMetadata).quizTitle
                : "this quiz";
            actions = [
              (label: "💬 Hint please", prompt: "Give me a conceptual hint for $quizTitle"),
              (label: "📚 Quick review", prompt: "Give me a 2-minute review for $quizTitle"),
            ];
            break;
          case ScreenType.general:
          default:
            actions = [
              (label: "📋 My syllabus", prompt: "Summarize my syllabus and upcoming modules"),
              (label: "🎯 Exam tips", prompt: "Give me high-impact study tips for my next exam"),
              (label: "📊 My progress", prompt: "How am I doing academically this semester?"),
            ];
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Text(
                "Quick actions",
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade500,
                  letterSpacing: 0.4,
                ),
              ),
            ),
            SizedBox(
              height: 46,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: actions.length,
                itemBuilder: (context, index) {
                  final action = actions[index];
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0.0, end: 1.0),
                      duration: Duration(milliseconds: 250 + (index * 80)),
                      curve: Curves.easeOutCubic,
                      builder: (context, value, child) {
                        return Transform.translate(
                          offset: Offset(16 * (1 - value), 0),
                          child: Opacity(
                            opacity: value,
                            child: child,
                          ),
                        );
                      },
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () {
                            context.read<ChatProvider>().sendMessage(action.prompt);
                          },
                          borderRadius: BorderRadius.circular(99),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(99),
                              color: Colors.white,
                              border: Border.all(color: const Color(0xFFF0E0CC), width: 1),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.03),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                )
                              ],
                            ),
                            child: Text(
                              action.label,
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: const Color(0xFF3C3C43),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),
          ],
        );
      },
    );
  }
}

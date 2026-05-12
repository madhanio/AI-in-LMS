import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../providers/app_context_provider.dart';
import '../../providers/chat_provider.dart';
import '../../models/app_context.dart';

class ContextualHeader extends StatelessWidget {
  const ContextualHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AppContextProvider>(
      builder: (context, contextProvider, child) {
        final appContext = contextProvider.currentContext;
        
        // Personalization (Normally from auth)
        const String studentName = "Madhan"; 
        
        String title = "Hey $studentName, ask me anything 👋";
        String subtitle = "";
        IconData contextIcon = Icons.auto_awesome;
        Color iconColor = const Color(0xFFF98012);

        switch (appContext.screenType) {
          case ScreenType.dashboard:
            subtitle = "Viewing Dashboard";
            contextIcon = Icons.dashboard_customize_outlined;
            break;
          case ScreenType.courseDetails:
            if (appContext.metadata is CourseMetadata) {
              final meta = appContext.metadata as CourseMetadata;
              subtitle = "Subject: ${meta.subjectName}";
            } else {
              subtitle = "Viewing Course";
            }
            contextIcon = Icons.book_outlined;
            iconColor = Colors.purple;
            break;
          case ScreenType.quiz:
            if (appContext.metadata is QuizMetadata) {
              final meta = appContext.metadata as QuizMetadata;
              subtitle = "Quiz: ${meta.quizTitle}";
            } else {
              subtitle = "Taking a Quiz";
            }
            contextIcon = Icons.quiz_outlined;
            iconColor = Colors.orange;
            break;
          case ScreenType.assignments:
            subtitle = "Viewing Assignments";
            contextIcon = Icons.assignment_outlined;
            iconColor = Colors.deepPurple;
            break;
          case ScreenType.profile:
            subtitle = "Viewing Profile";
            contextIcon = Icons.person_outline;
            iconColor = Colors.blue;
            break;
          case ScreenType.general:
            if (appContext.metadata is GenericMetadata) {
              final meta = appContext.metadata as GenericMetadata;
              subtitle = meta.title;
            }
            break;
        }

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            transitionBuilder: (Widget child, Animation<double> animation) {
              return FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0.0, -0.2),
                    end: Offset.zero,
                  ).animate(animation),
                  child: child,
                ),
              );
            },
            child: Row(
              key: ValueKey<String>("$title-$subtitle"),
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: iconColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(contextIcon, color: iconColor, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF1C1C1E),
                        ),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                      if (subtitle.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.w400,
                            color: Colors.grey.shade600,
                          ),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
                        ),
                      ]
                    ],
                  ),
                ),
                const SizedBox(width: 4),
                IconButton(
                  icon: const Icon(Icons.add_comment_outlined, size: 20),
                  color: Colors.grey.shade500,
                  tooltip: 'New Session',
                  onPressed: () {
                    context.read<ChatProvider>().resetChat();
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

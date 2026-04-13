import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/chat_provider.dart';

class SubjectChipRow extends StatelessWidget {
  const SubjectChipRow({super.key});

  @override
  Widget build(BuildContext context) {
    final chatProvider = context.watch<ChatProvider>();
    
    // 🎭 SKELETON LOADER: If loading, show pulsing placeholders so the app feels instant
    if (chatProvider.isLoadingSubjects) {
      return Container(
        height: 50,
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: 4,
          itemBuilder: (context, index) => Container(
            width: 80,
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: Colors.grey.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
          ),
        ),
      );
    }

    if (chatProvider.subjects.isEmpty) return const SizedBox.shrink();

    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: chatProvider.subjects.length,
        itemBuilder: (context, index) {
          final subject = chatProvider.subjects[index];
          final isSelected = chatProvider.selectedSubject == subject;
          
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: InkWell(
              onTap: () => chatProvider.selectSubject(subject),
              borderRadius: BorderRadius.circular(20),
            child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFFFF8C00) : Colors.transparent,
                  border: Border.all(
                    color: isSelected ? const Color(0xFFFF8C00) : const Color(0xFFD1D1D6),
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isSelected)
                      const Padding(
                        padding: EdgeInsets.only(right: 6),
                        child: Icon(Icons.check, size: 14, color: Colors.white),
                      ),
                    Text(
                      subject.split('(').last.replaceAll(')', ''), // Short name logic
                      style: GoogleFonts.inter(
                        color: isSelected ? Colors.white : const Color(0xFF6B6B6B),
                        fontSize: 13,
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

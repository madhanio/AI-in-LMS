import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class SuggestionCards extends StatelessWidget {
  final Function(String) onSelect;

  SuggestionCards({super.key, required this.onSelect});

  final List<Map<String, String>> suggestions = [
    {
      'title': 'Explain a Concept',
      'label': 'Explain the key concept of the latest lecture simply.',
      'icon': '💡'
    },
    {
      'title': 'Generate Quiz',
      'label': 'Create a 5-question multiple choice quiz from my syllabus.',
      'icon': '📝'
    },
    {
      'title': 'Calendar Check',
      'label': 'When is the next academic holiday or exam?',
      'icon': '📅'
    },
    {
      'title': 'Summarize',
      'label': 'Give me a brief summary of the uploaded study materials.',
      'icon': '📚'
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 160,
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: suggestions.length,
        itemBuilder: (context, index) {
          final s = suggestions[index];
          return Padding(
            padding: const EdgeInsets.only(right: 12),
            child: InkWell(
              onTap: () => onSelect(s['label']!),
              borderRadius: BorderRadius.circular(20),
              child: Container(
                width: 150,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.grey.shade200),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    )
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(s['icon']!, style: const TextStyle(fontSize: 24)),
                    const Spacer(),
                    Text(
                      s['title']!,
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: const Color(0xFF1C1C1E),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      s['label']!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: Colors.grey.shade600,
                        height: 1.3,
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

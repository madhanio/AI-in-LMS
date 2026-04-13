import 'message.dart';

class ChatSession {
  final String id;
  final String title;
  final List<Message> messages;
  final DateTime timestamp;
  final String? subject;

  ChatSession({
    required this.id,
    required this.title,
    required this.messages,
    required this.timestamp,
    this.subject,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'messages': messages.map((m) => m.toJson()).toList(),
    'timestamp': timestamp.toIso8601String(),
    'subject': subject,
  };

  factory ChatSession.fromJson(Map<String, dynamic> json) => ChatSession(
    id: json['id'],
    title: json['title'],
    messages: (json['messages'] as List).map((m) => Message.fromJson(m)).toList(),
    timestamp: DateTime.parse(json['timestamp']),
    subject: json['subject'],
  );
}

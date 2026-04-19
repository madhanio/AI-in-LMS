class Message {
  final String id;
  String text; // mutable for streaming append
  final bool isUser;
  final bool isSystemSwitch;
  final DateTime createdAt;
  List<Map<String, dynamic>>? sources; // Added for RAG citations
  
  Message({
    required this.id,
    required this.text,
    required this.isUser,
    this.isSystemSwitch = false,
    this.sources,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toJson() => {
    'id': id,
    'text': text,
    'isUser': isUser,
    'isSystemSwitch': isSystemSwitch,
    'createdAt': createdAt.toIso8601String(),
    if (sources != null) 'sources': sources,
  };

  factory Message.fromJson(Map<String, dynamic> json) => Message(
    id: json['id'],
    text: json['text'],
    isUser: json['isUser'],
    isSystemSwitch: json['isSystemSwitch'] ?? false,
    createdAt: DateTime.parse(json['createdAt']),
    sources: json['sources'] != null 
        ? List<Map<String, dynamic>>.from(json['sources']) 
        : null,
  );
}

class Message {
  final String id;
  String text; // mutable for streaming append
  final bool isUser;
  final bool isSystemSwitch;
  final DateTime createdAt;
  
  Message({
    required this.id,
    required this.text,
    required this.isUser,
    this.isSystemSwitch = false,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();
}

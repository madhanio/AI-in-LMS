class HiveConstants {
  // Hive Boxes
  static const String chatBox = 'chat_box';

  // Type IDs for Hive Adapters
  // Using explicit, hardcoded IDs to prevent issues during migrations
  
  // Enums
  static const int senderRoleTypeId = 0;
  static const int screenTypeTypeId = 1;

  // Models
  static const int messageTypeId = 2;
  static const int appContextTypeId = 3;
  static const int restrictionFlagsTypeId = 4;
  
  // Metadata Subclasses
  static const int screenMetadataTypeId = 5;
  static const int courseMetadataTypeId = 6;
  static const int quizMetadataTypeId = 7;
  static const int genericMetadataTypeId = 8;
}

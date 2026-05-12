import 'package:hive/hive.dart';
import 'hive_constants.dart';

part 'app_context.g.dart';

@HiveType(typeId: HiveConstants.screenTypeTypeId)
enum ScreenType {
  @HiveField(0)
  dashboard,
  @HiveField(1)
  courseDetails,
  @HiveField(2)
  quiz,
  @HiveField(3)
  profile,
  @HiveField(4)
  general,
  @HiveField(5)
  assignments,
  @HiveField(6)
  aiChat,
}

@HiveType(typeId: HiveConstants.restrictionFlagsTypeId)
class RestrictionFlags {
  @HiveField(0)
  final bool canUseAI;
  @HiveField(1)
  final bool isProctored;
  @HiveField(2)
  final bool showOrb;

  const RestrictionFlags({
    this.canUseAI = true,
    this.isProctored = false,
    this.showOrb = true,
  });

  static const RestrictionFlags none = RestrictionFlags();
  static const RestrictionFlags proctored = RestrictionFlags(
    canUseAI: false,
    isProctored: true,
    showOrb: false,
  );
}

abstract class ScreenMetadata {
  const ScreenMetadata();
}

@HiveType(typeId: HiveConstants.courseMetadataTypeId)
class CourseMetadata extends ScreenMetadata {
  @HiveField(0)
  final String subjectId;
  @HiveField(1)
  final String subjectName;
  @HiveField(2)
  final int? moduleNumber;

  const CourseMetadata({
    required this.subjectId,
    required this.subjectName,
    this.moduleNumber,
  });
}

@HiveType(typeId: HiveConstants.quizMetadataTypeId)
class QuizMetadata extends ScreenMetadata {
  @HiveField(0)
  final String quizId;
  @HiveField(1)
  final String quizTitle;

  const QuizMetadata({
    required this.quizId,
    required this.quizTitle,
  });
}

@HiveType(typeId: HiveConstants.genericMetadataTypeId)
class GenericMetadata extends ScreenMetadata {
  @HiveField(0)
  final String title;

  const GenericMetadata({required this.title});
}

@HiveType(typeId: HiveConstants.appContextTypeId)
class AppContext {
  @HiveField(0)
  final ScreenType screenType;
  @HiveField(1)
  final ScreenMetadata? metadata;
  @HiveField(2)
  final RestrictionFlags restrictionFlags;
  @HiveField(3)
  final DateTime timestamp;

  AppContext({
    required this.screenType,
    this.metadata,
    this.restrictionFlags = RestrictionFlags.none,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  static AppContext defaultContext() {
    return AppContext(
      screenType: ScreenType.general,
      metadata: const GenericMetadata(title: 'General Academics'),
    );
  }
}

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_context.dart';

// **************************************************************************
// TypeAdapterGenerator
// **************************************************************************

class RestrictionFlagsAdapter extends TypeAdapter<RestrictionFlags> {
  @override
  final int typeId = 4;

  @override
  RestrictionFlags read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return RestrictionFlags(
      canUseAI: fields[0] as bool,
      isProctored: fields[1] as bool,
      showOrb: fields[2] as bool,
    );
  }

  @override
  void write(BinaryWriter writer, RestrictionFlags obj) {
    writer
      ..writeByte(3)
      ..writeByte(0)
      ..write(obj.canUseAI)
      ..writeByte(1)
      ..write(obj.isProctored)
      ..writeByte(2)
      ..write(obj.showOrb);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RestrictionFlagsAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}

class CourseMetadataAdapter extends TypeAdapter<CourseMetadata> {
  @override
  final int typeId = 6;

  @override
  CourseMetadata read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return CourseMetadata(
      subjectId: fields[0] as String,
      subjectName: fields[1] as String,
      moduleNumber: fields[2] as int?,
    );
  }

  @override
  void write(BinaryWriter writer, CourseMetadata obj) {
    writer
      ..writeByte(3)
      ..writeByte(0)
      ..write(obj.subjectId)
      ..writeByte(1)
      ..write(obj.subjectName)
      ..writeByte(2)
      ..write(obj.moduleNumber);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CourseMetadataAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}

class QuizMetadataAdapter extends TypeAdapter<QuizMetadata> {
  @override
  final int typeId = 7;

  @override
  QuizMetadata read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return QuizMetadata(
      quizId: fields[0] as String,
      quizTitle: fields[1] as String,
    );
  }

  @override
  void write(BinaryWriter writer, QuizMetadata obj) {
    writer
      ..writeByte(2)
      ..writeByte(0)
      ..write(obj.quizId)
      ..writeByte(1)
      ..write(obj.quizTitle);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is QuizMetadataAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}

class GenericMetadataAdapter extends TypeAdapter<GenericMetadata> {
  @override
  final int typeId = 8;

  @override
  GenericMetadata read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return GenericMetadata(
      title: fields[0] as String,
    );
  }

  @override
  void write(BinaryWriter writer, GenericMetadata obj) {
    writer
      ..writeByte(1)
      ..writeByte(0)
      ..write(obj.title);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is GenericMetadataAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}

class AppContextAdapter extends TypeAdapter<AppContext> {
  @override
  final int typeId = 3;

  @override
  AppContext read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return AppContext(
      screenType: fields[0] as ScreenType,
      metadata: fields[1] as ScreenMetadata?,
      restrictionFlags: fields[2] as RestrictionFlags,
      timestamp: fields[3] as DateTime?,
    );
  }

  @override
  void write(BinaryWriter writer, AppContext obj) {
    writer
      ..writeByte(4)
      ..writeByte(0)
      ..write(obj.screenType)
      ..writeByte(1)
      ..write(obj.metadata)
      ..writeByte(2)
      ..write(obj.restrictionFlags)
      ..writeByte(3)
      ..write(obj.timestamp);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AppContextAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}

class ScreenTypeAdapter extends TypeAdapter<ScreenType> {
  @override
  final int typeId = 1;

  @override
  ScreenType read(BinaryReader reader) {
    switch (reader.readByte()) {
      case 0:
        return ScreenType.dashboard;
      case 1:
        return ScreenType.courseDetails;
      case 2:
        return ScreenType.quiz;
      case 3:
        return ScreenType.profile;
      case 4:
        return ScreenType.general;
      case 5:
        return ScreenType.assignments;
      default:
        return ScreenType.dashboard;
    }
  }

  @override
  void write(BinaryWriter writer, ScreenType obj) {
    switch (obj) {
      case ScreenType.dashboard:
        writer.writeByte(0);
        break;
      case ScreenType.courseDetails:
        writer.writeByte(1);
        break;
      case ScreenType.quiz:
        writer.writeByte(2);
        break;
      case ScreenType.profile:
        writer.writeByte(3);
        break;
      case ScreenType.general:
        writer.writeByte(4);
        break;
      case ScreenType.assignments:
        writer.writeByte(5);
        break;
    }
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ScreenTypeAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}

class FabClearance {
  final double height;
  final double padding;

  const FabClearance({
    required this.height,
    this.padding = 16.0,
  });

  /// The total clearance required for the FAB, including padding.
  double get totalClearance => height + padding;

  /// A default clearance when no FAB is present.
  static const FabClearance none = FabClearance(height: 0, padding: 0);
}

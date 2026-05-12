import 'package:flutter/material.dart';

mixin SheetKeyboardController<T extends StatefulWidget> on State<T> {
  double get keyboardHeight => MediaQuery.of(context).viewInsets.bottom;
  bool get isKeyboardOpen => keyboardHeight > 0;

  /// Calculates the extra padding needed to keep the input bar visible
  double get keyboardPadding {
    // If the DraggableScrollableSheet is already expanded high enough, 
    // it naturally handles the keyboard. But at lower snap points, 
    // we need to push the content up.
    if (isKeyboardOpen) {
      return keyboardHeight;
    }
    return 0.0;
  }
}

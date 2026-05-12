import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/app_context.dart';
import '../../providers/app_context_provider.dart';
import 'floating_ai_orb.dart';
import 'ai_bottom_sheet.dart';

class AiOverlayLayer extends StatefulWidget {
  final Widget child;

  const AiOverlayLayer({super.key, required this.child});

  // Global signal to force hide the orb from any screen
  static final ValueNotifier<bool> forceHideOrb = ValueNotifier(false);

  @override
  State<AiOverlayLayer> createState() => _AiOverlayLayerState();
}

class _AiOverlayLayerState extends State<AiOverlayLayer>
    with SingleTickerProviderStateMixin {
  bool _isSheetOpen = false;

  late AnimationController _orbEntranceController;
  late Animation<double> _orbScaleAnimation;
  late Animation<Offset> _orbSlideAnimation;

  @override
  void initState() {
    super.initState();

    _orbEntranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _orbScaleAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _orbEntranceController,
        curve: const Interval(0.0, 0.8, curve: Curves.easeOutBack),
      ),
    );
    _orbSlideAnimation =
        Tween<Offset>(begin: const Offset(0.5, 0.5), end: Offset.zero).animate(
          CurvedAnimation(
            parent: _orbEntranceController,
            curve: const Interval(0.0, 0.7, curve: Curves.easeOutCubic),
          ),
        );

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _orbEntranceController.forward();
    });
  }

  void _openSheet() {
    setState(() {
      _isSheetOpen = true;
    });
    _orbEntranceController.reverse();
  }

  void _closeSheet() {
    setState(() {
      _isSheetOpen = false;
    });
  }

  @override
  void dispose() {
    _orbEntranceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: AiOverlayLayer.forceHideOrb,
      builder: (context, forceHide, _) {
        // 🚀 NUCLEAR FIX: If force-hide is active (Chat Screen), 
        // completely bypass the overlay and return only the main app.
        // This is guaranteed to hide the orb.
        if (forceHide) {
          return widget.child;
        }

        return Consumer<AppContextProvider>(
          builder: (context, provider, _) {
            final bool isProctored = provider.currentContext.restrictionFlags.isProctored;
            final bool showOrb = provider.currentContext.restrictionFlags.showOrb;
            final bool isChatScreen = provider.currentContext.screenType == ScreenType.aiChat;

            // Sync visibility state
            final bool shouldShowOrb = showOrb && !_isSheetOpen && !isProctored && !isChatScreen;

            return Stack(
              children: [
                // 1. The Main App (Navigator, etc)
                widget.child,

                // 2. The AI Overlay
                Positioned.fill(
                  child: Overlay(
                    initialEntries: [
                      OverlayEntry(
                        builder: (context) => Material(
                          type: MaterialType.transparency,
                          child: Stack(
                            children: [
                              // Floating AI Orb - Using Implicit Animations
                              Positioned(
                                right: 20,
                                bottom: MediaQuery.of(context).padding.bottom + 80 + provider.fabClearance.totalClearance,
                                child: AnimatedOpacity(
                                  opacity: shouldShowOrb ? 1.0 : 0.0,
                                  duration: const Duration(milliseconds: 300),
                                  curve: Curves.easeInOut,
                                  child: AnimatedScale(
                                    scale: shouldShowOrb ? 1.0 : 0.0,
                                    duration: const Duration(milliseconds: 350),
                                    curve: Curves.easeOutBack,
                                    child: IgnorePointer(
                                      ignoring: !shouldShowOrb,
                                      child: FloatingAiOrb(onTap: _openSheet),
                                    ),
                                  ),
                                ),
                              ),

                              // AI Bottom Sheet
                              if (_isSheetOpen)
                                AiBottomSheet(
                                  onClose: _closeSheet,
                                ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

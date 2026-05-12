import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/app_context_provider.dart';
import 'floating_ai_orb.dart';
import 'ai_bottom_sheet.dart';

/// A global overlay manager that inserts the AI Orb and Bottom Sheet into the Navigator's Overlay.
/// Should be used as a wrapper around the root screen (e.g., home: AiOverlayLayer(child: Dashboard())).
class AiOverlayLayer extends StatefulWidget {
  final Widget child;

  const AiOverlayLayer({super.key, required this.child});

  @override
  State<AiOverlayLayer> createState() => _AiOverlayLayerState();
}

class _AiOverlayLayerState extends State<AiOverlayLayer>
    with SingleTickerProviderStateMixin {
  OverlayEntry? _overlayEntry;
  bool _isSheetOpen = false;
  bool _isTransitioning = false;

  // Orb entrance animation
  late AnimationController _orbEntranceController;
  late Animation<double> _orbScaleAnimation;
  late Animation<Offset> _orbSlideAnimation;

  @override
  void initState() {
    super.initState();

    // iOS-style orb entrance — scale + slide from bottom-right
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
        Tween<Offset>(begin: const Offset(0.5, 0.5), end: Offset.zero)
            .animate(
      CurvedAnimation(
        parent: _orbEntranceController,
        curve: const Interval(0.0, 0.7, curve: Curves.easeOutCubic),
      ),
    );

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppContextProvider>().initialize();
      _refreshOverlay();
      // Delay orb entrance for a premium feel
      Future.delayed(const Duration(milliseconds: 300), () {
        if (mounted) _orbEntranceController.forward();
      });
    });
  }

  @override
  void didUpdateWidget(AiOverlayLayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    _refreshOverlay();
  }

  @override
  void dispose() {
    _orbEntranceController.dispose();
    _overlayEntry?.remove();
    _overlayEntry = null;
    super.dispose();
  }

  void _refreshOverlay() {
    if (!mounted) return;

    if (_overlayEntry == null) {
      _overlayEntry = OverlayEntry(
        builder: (context) => _buildOverlayContent(context),
      );
      Overlay.of(context).insert(_overlayEntry!);
    } else {
      _overlayEntry?.markNeedsBuild();
    }
  }

  void _openSheet() {
    if (_isTransitioning) return;
    setState(() {
      _isSheetOpen = true;
    });
    // Hide orb with a quick scale-down
    _orbEntranceController.reverse();
    _overlayEntry?.markNeedsBuild();
  }

  void _closeSheet() {
    if (_isTransitioning) return;
    setState(() {
      _isSheetOpen = false;
    });
    // Bring orb back with spring animation
    Future.delayed(const Duration(milliseconds: 150), () {
      if (mounted) _orbEntranceController.forward();
    });
    _overlayEntry?.markNeedsBuild();
  }

  Widget _buildOverlayContent(BuildContext context) {
    return Consumer<AppContextProvider>(
      builder: (context, provider, _) {
        if (!provider.isReady) return const SizedBox.shrink();

        final bool isProctored =
            provider.currentContext.restrictionFlags.isProctored;
        final bool showOrb =
            provider.currentContext.restrictionFlags.showOrb;

        if (isProctored || !showOrb) return const SizedBox.shrink();

        return Stack(
          children: [
            // The Orb — with animated entrance
            if (!_isSheetOpen)
              Positioned(
                bottom: MediaQuery.of(context).padding.bottom +
                    80 +
                    provider.fabClearance.totalClearance,
                right: 16,
                child: AnimatedBuilder(
                  animation: _orbEntranceController,
                  builder: (context, child) {
                    return Transform.scale(
                      scale: _orbScaleAnimation.value,
                      child: SlideTransition(
                        position: _orbSlideAnimation,
                        child: child,
                      ),
                    );
                  },
                  child: Material(
                    type: MaterialType.transparency,
                    child: FloatingAiOrb(
                      onTap: _openSheet,
                    ),
                  ),
                ),
              ),

            // The Bottom Sheet — fullscreen overlay on top of everything
            // AnimatedSwitcher correctly wraps the conditional to enable exit animations
            Positioned.fill(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 400),
                reverseDuration: const Duration(milliseconds: 300),
                switchInCurve: Curves.easeOutCubic,
                switchOutCurve: Curves.easeInCubic,
                transitionBuilder: (child, animation) => FadeTransition(
                  opacity: animation,
                  child: child,
                ),
                child: _isSheetOpen
                    ? Material(
                        key: const ValueKey('AiBottomSheet'),
                        type: MaterialType.transparency,
                        child: AiBottomSheet(
                          onClose: _closeSheet,
                        ),
                      )
                    : const SizedBox.shrink(key: ValueKey('None')),
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}

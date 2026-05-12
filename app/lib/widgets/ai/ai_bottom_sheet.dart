import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:ui';
import '../../providers/chat_provider.dart';
import 'sheet_keyboard_controller.dart';
import '../message_bubble.dart';
import '../typing_indicator.dart';
import '../input_bar.dart';
import 'contextual_header.dart';
import 'quick_actions_row.dart';
import '../../ai_chat_screen.dart';

class AiBottomSheet extends StatefulWidget {
  final GlobalKey? headerKey;
  final VoidCallback onClose;

  const AiBottomSheet({super.key, this.headerKey, required this.onClose});

  @override
  State<AiBottomSheet> createState() => _AiBottomSheetState();
}

class _AiBottomSheetState extends State<AiBottomSheet>
    with SheetKeyboardController, TickerProviderStateMixin {
  final DraggableScrollableController _sheetController =
      DraggableScrollableController();
  late final ScrollController _messageScrollController;
  final TextEditingController _inputController = TextEditingController();

  // Handle-only snap points.
  static const double _minSize = 0.0;
  static const double _quickSize = 0.62;
  static const double _typingSize = 0.76;
  static const double _expandedSize = 0.82; // streaming expansion target
  static const double _fullSize = 0.95;
  static const double _dismissThreshold = 0.08;
  static const double _fullScreenThreshold = 0.86;

  // Animation controllers
  late AnimationController _backdropController;
  late Animation<double> _backdropAnimation;

  // State tracking
  bool _isNavigatingToFullScreen = false;
  bool _wasStreaming = false;
  bool _wasKeyboardOpen = false;
  int _lastMessageCount = 0;

  @override
  void initState() {
    super.initState();
    _messageScrollController = ScrollController();

    // Backdrop fade-in — iOS-style soft entrance
    _backdropController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _backdropAnimation = CurvedAnimation(
      parent: _backdropController,
      curve: Curves.easeOutCubic,
    );
    _backdropController.forward();

    // Ensure the controller settles at the readable quick height after mount.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_sheetController.isAttached) {
        _sheetController.animateTo(
          _quickSize,
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOutCubic,
        );
      }
    });
  }

  /// Auto-scroll to bottom. During streaming, always chase the bottom.
  void _scrollToBottom({bool force = false}) {
    if (_messageScrollController.hasClients) {
      final maxScroll = _messageScrollController.position.maxScrollExtent;
      final currentScroll = _messageScrollController.position.pixels;

      // During streaming always scroll; otherwise only if near bottom
      if (force || maxScroll - currentScroll <= 200) {
        _messageScrollController.animateTo(
          maxScroll,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOutCubic,
        );
      }
    }
  }

  /// Dynamically expand the sheet as AI streams content
  void _handleStreamingExpansion(ChatProvider chatProvider) {
    final isStreaming = chatProvider.isStreaming;
    final messageCount = chatProvider.messages.length;

    // When streaming starts or new messages arrive, gradually expand
    if (isStreaming &&
        !_isNavigatingToFullScreen &&
        _sheetController.isAttached) {
      final currentSize = _sheetController.size;

      // Only expand if we're below the expanded threshold
      if (currentSize < _expandedSize && currentSize >= _quickSize - 0.05) {
        // Smooth incremental expansion — don't jump, glide
        final targetSize =
            (_typingSize +
                    ((_expandedSize - _typingSize) *
                        ((messageCount - _lastMessageCount).clamp(0, 5) / 5.0)))
                .clamp(_typingSize, _expandedSize);

        if (targetSize > currentSize + 0.02) {
          _sheetController.animateTo(
            targetSize,
            duration: const Duration(milliseconds: 600),
            curve: Curves.easeOutCubic,
          );
        }
      }

      // Always auto-scroll during streaming
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollToBottom(force: true);
      });
    }

    // When streaming finishes, update tracking
    if (_wasStreaming && !isStreaming) {
      _lastMessageCount = messageCount;
    }
    _wasStreaming = isStreaming;
  }

  /// Seamless navigation to full-screen chat — iOS-style morph
  void _navigateToFullScreenChat() {
    if (_isNavigatingToFullScreen) return;
    _isNavigatingToFullScreen = true;

    // Fade out the backdrop simultaneously
    _backdropController.reverse(from: 0.3);

    Navigator.of(context, rootNavigator: true).push(_createSmoothRoute()).then((
      _,
    ) {
      // When returning from full screen, close the sheet
      widget.onClose();
    });
  }

  /// Creates an iOS-style seamless page transition
  Route _createSmoothRoute() {
    return PageRouteBuilder(
      transitionDuration: const Duration(milliseconds: 400),
      reverseTransitionDuration: const Duration(milliseconds: 350),
      opaque: true,
      pageBuilder: (context, animation, secondaryAnimation) {
        return const AiChatScreen();
      },
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        // Combined slide-up + fade for seamless morph effect
        final slideAnimation =
            Tween<Offset>(
              begin: const Offset(0, 0.05), // Subtle — just 5% from bottom
              end: Offset.zero,
            ).animate(
              CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
            );

        final fadeAnimation = CurvedAnimation(
          parent: animation,
          curve: const Interval(0.0, 0.6, curve: Curves.easeOut),
        );

        return SlideTransition(
          position: slideAnimation,
          child: FadeTransition(opacity: fadeAnimation, child: child),
        );
      },
    );
  }

  /// Smooth dismiss animation
  void _dismissSheet() {
    if (!_sheetController.isAttached) {
      widget.onClose();
      return;
    }

    _backdropController.reverse();
    _sheetController
        .animateTo(
          0.0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInCubic,
        )
        .then((_) {
          widget.onClose();
        });
  }

  void _syncKeyboardDrivenHeight() {
    final keyboardOpen = isKeyboardOpen;
    if (keyboardOpen == _wasKeyboardOpen ||
        _isNavigatingToFullScreen ||
        !_sheetController.isAttached) {
      return;
    }

    _wasKeyboardOpen = keyboardOpen;
    final currentSize = _sheetController.size;
    if (keyboardOpen && currentSize < _typingSize) {
      _sheetController.animateTo(
        _typingSize,
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
      );
    } else if (!keyboardOpen && currentSize > _typingSize - 0.04) {
      _sheetController.animateTo(
        _quickSize,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
      );
    }
  }

  void _handleDragUpdate(DragUpdateDetails details) {
    if (!_sheetController.isAttached || _isNavigatingToFullScreen) return;

    final screenHeight = MediaQuery.of(context).size.height;
    final nextSize =
        (_sheetController.size - (details.primaryDelta ?? 0) / screenHeight)
            .clamp(_minSize, _fullSize);
    _sheetController.jumpTo(nextSize);
  }

  void _handleDragEnd(DragEndDetails details) {
    if (!_sheetController.isAttached || _isNavigatingToFullScreen) return;

    final velocity = details.primaryVelocity ?? 0;
    final currentSize = _sheetController.size;

    if (velocity < -700 || currentSize >= _fullScreenThreshold) {
      _navigateToFullScreenChat();
      return;
    }

    if (velocity > 450 || currentSize <= _dismissThreshold) {
      _dismissSheet();
      return;
    }

    final targetSize = currentSize < (_quickSize + _typingSize) / 2
        ? _quickSize
        : _typingSize;
    final distance = (currentSize - targetSize).abs();
    final durationMs = (120 + (distance * 360)).round().clamp(120, 260);

    _sheetController.animateTo(
      targetSize,
      duration: Duration(milliseconds: durationMs),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  void dispose() {
    _backdropController.dispose();
    _sheetController.dispose();
    _messageScrollController.dispose();
    _inputController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _syncKeyboardDrivenHeight(),
    );

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _dismissSheet();
      },
      child: Stack(
        children: [
          // Animated backdrop with blur
          GestureDetector(
            onTap: _dismissSheet,
            behavior: HitTestBehavior.opaque,
            child: AnimatedBuilder(
              animation: _backdropAnimation,
              builder: (context, child) {
                return BackdropFilter(
                  filter: ImageFilter.blur(
                    sigmaX: 3.0 * _backdropAnimation.value,
                    sigmaY: 3.0 * _backdropAnimation.value,
                  ),
                  child: Container(
                    color: Colors.black.withValues(
                      alpha: 0.45 * _backdropAnimation.value,
                    ),
                  ),
                );
              },
            ),
          ),

          // The draggable sheet
          NotificationListener<DraggableScrollableNotification>(
            onNotification: (notification) {
              // Dismiss when dragged below threshold
              if (notification.extent <= _dismissThreshold) {
                _dismissSheet();
                return true;
              }

              // Navigate to full screen when swiped up past threshold
              if (notification.extent >= _fullScreenThreshold &&
                  !_isNavigatingToFullScreen) {
                _navigateToFullScreenChat();
                return true;
              }

              return false;
            },
            child: DraggableScrollableSheet(
              controller: _sheetController,
              initialChildSize: _quickSize,
              minChildSize: _minSize,
              maxChildSize: _fullSize,
              snap: false,
              builder: (BuildContext context, ScrollController _) {
                return Material(
                  color: Colors.transparent,
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final bool showInputBar = constraints.maxHeight > 220;
                      const double borderRadius = 24.0;

                      return Container(
                        padding: EdgeInsets.only(bottom: keyboardPadding),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEFDFB),
                          borderRadius: BorderRadius.vertical(
                            top: Radius.circular(borderRadius),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.08),
                              blurRadius: 24,
                              spreadRadius: 0,
                              offset: const Offset(0, -4),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.vertical(
                            top: Radius.circular(borderRadius),
                          ),
                          child: Stack(
                            children: [
                              // 1. Messages Area
                              Positioned.fill(
                                child: Consumer<ChatProvider>(
                                  builder: (context, chatProvider, child) {
                                    // Handle streaming expansion
                                    _handleStreamingExpansion(chatProvider);

                                    WidgetsBinding.instance
                                        .addPostFrameCallback(
                                          (_) => _scrollToBottom(
                                            force: chatProvider.isStreaming,
                                          ),
                                        );

                                    final messages = chatProvider.messages;
                                    final isTyping = chatProvider.isTyping;
                                    final showSuggestions =
                                        messages.isEmpty &&
                                        chatProvider.history.isEmpty &&
                                        !isTyping;
                                    final extraWidgets =
                                        (isTyping ? 1 : 0) +
                                        (showSuggestions ? 1 : 0);

                                    return ListView.builder(
                                      controller: _messageScrollController,
                                      physics: const BouncingScrollPhysics(
                                        parent: AlwaysScrollableScrollPhysics(),
                                      ),
                                      padding: const EdgeInsets.only(
                                        top: 92,
                                        bottom: 82,
                                        left: 16,
                                        right: 16,
                                      ),
                                      itemCount: messages.length + extraWidgets,
                                      itemBuilder: (context, index) {
                                        if (index < messages.length) {
                                          return Padding(
                                            padding: const EdgeInsets.only(
                                              bottom: 3,
                                            ),
                                            child: MessageBubble(
                                              message: messages[index],
                                            ),
                                          );
                                        }

                                        if (isTyping &&
                                            index == messages.length) {
                                          return const Padding(
                                            padding: EdgeInsets.only(bottom: 3),
                                            child: TypingIndicator(),
                                          );
                                        }

                                        if (showSuggestions) {
                                          return const QuickActionsRow();
                                        }

                                        return const SizedBox.shrink();
                                      },
                                    );
                                  },
                                ),
                              ),

                              // 2. Pinned Header with glassmorphism
                              Positioned(
                                top: 0,
                                left: 0,
                                right: 0,
                                child: ClipRect(
                                  child: BackdropFilter(
                                    filter: ImageFilter.blur(
                                      sigmaX: 20,
                                      sigmaY: 20,
                                    ),
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: const Color(
                                          0xFFFEFDFB,
                                        ).withValues(alpha: 0.88),
                                        border: Border(
                                          bottom: BorderSide(
                                            color: Colors.grey.shade200
                                                .withValues(alpha: 0.5),
                                            width: 0.5,
                                          ),
                                        ),
                                      ),
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          GestureDetector(
                                            behavior:
                                                HitTestBehavior.translucent,
                                            onVerticalDragUpdate:
                                                _handleDragUpdate,
                                            onVerticalDragEnd: _handleDragEnd,
                                            child: SizedBox(
                                              height: 40,
                                              child: Center(
                                                child: Container(
                                                  width: 52,
                                                  height: 6,
                                                  decoration: BoxDecoration(
                                                    color: Colors.grey.shade300,
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                          3,
                                                        ),
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                          ContextualHeader(
                                            key: widget.headerKey,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),

                              // 3. Pinned Input Bar with glassmorphism
                              if (showInputBar)
                                Positioned(
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  child: ClipRect(
                                    child: BackdropFilter(
                                      filter: ImageFilter.blur(
                                        sigmaX: 20,
                                        sigmaY: 20,
                                      ),
                                      child: Container(
                                        decoration: BoxDecoration(
                                          color: const Color(
                                            0xFFFEFDFB,
                                          ).withValues(alpha: 0.88),
                                          border: Border(
                                            top: BorderSide(
                                              color: Colors.grey.shade200
                                                  .withValues(alpha: 0.5),
                                              width: 0.5,
                                            ),
                                          ),
                                        ),
                                        child: SafeArea(
                                          top: false,
                                          child: InputBar(
                                            controller: _inputController,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

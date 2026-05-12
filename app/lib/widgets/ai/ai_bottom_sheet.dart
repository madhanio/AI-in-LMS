import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../main.dart';
import '../../ai_chat_screen.dart';
import '../../providers/chat_provider.dart';
import '../input_bar.dart';
import '../message_bubble.dart';
import '../typing_indicator.dart';
import 'quick_actions_row.dart';
import 'ai_overlay_layer.dart';

class AiBottomSheet extends StatefulWidget {
  final GlobalKey? headerKey;
  final VoidCallback onClose;
  final String screenContext;

  const AiBottomSheet({
    super.key,
    this.headerKey,
    required this.onClose,
    this.screenContext = 'general',
  });

  @override
  State<AiBottomSheet> createState() => _AiBottomSheetState();
}

class _AiBottomSheetState extends State<AiBottomSheet> {
  final ScrollController _messageScrollController = ScrollController();
  final TextEditingController _inputController = TextEditingController();

  double _sheetHeight = 300; // starting peek height
  double _maxHeight = 300;
  double _minHeight = 120;
  Duration _animDuration = Duration.zero;

  bool _isNavigatingToFullScreen = false;
  bool _wasKeyboardOpen = false;
  bool _isDragging = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final chatProvider = context.read<ChatProvider>();
      final hasUserMessages = chatProvider.messages.any((m) => m.isUser);
      
      setState(() {
        _maxHeight = MediaQuery.of(context).size.height * 0.92;
        _minHeight = MediaQuery.of(context).size.height * 0.18;
        // Start at 68% if there are already user messages, else peek at 45%
        _sheetHeight = hasUserMessages 
            ? MediaQuery.of(context).size.height * 0.68 
            : MediaQuery.of(context).size.height * 0.45;
      });
    });
  }

  String get _headerTitle {
    switch (widget.screenContext) {
      case 'dashboard':
        return "I can see your Dashboard 📊";
      case 'timeline':
        return "Viewing your Timeline 📅";
      case 'exam':
        return "Exam prep time! 🎯";
      default:
        return "Hey Madhan, ask me anything 👋";
    }
  }

  String get _headerSubtitle {
    switch (widget.screenContext) {
      case 'dashboard':
        return "Want a summary of your progress?";
      case 'timeline':
        return "Any tasks or deadlines to discuss?";
      default:
        return "General Academics";
    }
  }

  void _scrollToBottom({bool force = false}) {
    if (!_messageScrollController.hasClients) return;

    final maxScroll = _messageScrollController.position.maxScrollExtent;
    final currentScroll = _messageScrollController.position.pixels;

    if (force || maxScroll - currentScroll <= 200) {
      _messageScrollController.animateTo(
        maxScroll,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutCubic,
      );
    }
  }

  void _navigateToFullScreenChat() {
    if (_isNavigatingToFullScreen) return;
    _isNavigatingToFullScreen = true;

    // 🚀 HIDE ORB IMMEDIATELY: Set the signal before navigation
    AiOverlayLayer.forceHideOrb.value = true;

    widget.onClose();
    navigatorKey.currentState?.push(
      MaterialPageRoute(
        settings: const RouteSettings(name: 'ai_chat'),
        builder: (_) => const AiChatScreen(),
      ),
    ).then((_) {
      // Restore navigation flag when coming back
      _isNavigatingToFullScreen = false;
    });
  }

  void _dismissSheet() {
    widget.onClose();
  }

  void _syncKeyboardHeight() {
    if (!mounted || _isNavigatingToFullScreen || _isDragging) return;

    final viewInsets = MediaQuery.of(context).viewInsets;
    final keyboardOpen = viewInsets.bottom > 0;
    
    // Only auto-adjust if the keyboard state actually changed
    if (keyboardOpen == _wasKeyboardOpen) return;

    final screenHeight = MediaQuery.of(context).size.height;
    final chatProvider = context.read<ChatProvider>();
    final hasUserMessages = chatProvider.messages.any((m) => m.isUser);

    final targetHeight = (keyboardOpen || hasUserMessages) 
        ? screenHeight * 0.68 
        : screenHeight * 0.45;

    setState(() {
      _animDuration = const Duration(milliseconds: 300);
      _sheetHeight = targetHeight;
      _wasKeyboardOpen = keyboardOpen;
    });
  }

  @override
  void dispose() {
    _messageScrollController.dispose();
    _inputController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncKeyboardHeight());

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _dismissSheet();
      },
      child: Stack(
        children: [
          GestureDetector(
            onTap: _dismissSheet,
            behavior: HitTestBehavior.opaque,
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 3, sigmaY: 3),
              child: Container(color: Colors.black.withValues(alpha: 0.45)),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 10,
                    offset: const Offset(0, -2),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
                child: AnimatedContainer(
                  duration: _animDuration,
                  curve: Curves.easeOutCubic,
                  height: _sheetHeight,
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: Consumer<ChatProvider>(
                          builder: (context, chatProvider, child) {
                            WidgetsBinding.instance.addPostFrameCallback(
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
                                (isTyping ? 1 : 0) + (showSuggestions ? 1 : 0);

                            return ListView.builder(
                              controller: _messageScrollController,
                              physics: const BouncingScrollPhysics(
                                parent: AlwaysScrollableScrollPhysics(),
                              ),
                              padding: const EdgeInsets.only(
                                top: 106,
                                left: 16,
                                right: 16,
                                bottom: 100,
                              ),
                              itemCount: messages.length + extraWidgets,
                              itemBuilder: (context, index) {
                                if (index < messages.length) {
                                  return MessageBubble(
                                    message: messages[index],
                                  );
                                }

                                if (isTyping && index == messages.length) {
                                  return const Padding(
                                    padding: EdgeInsets.only(bottom: 8),
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
                      Positioned(
                        top: 0,
                        left: 0,
                        right: 0,
                        child: _buildHeader(context),
                      ),
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: Container(
                          color: Theme.of(context).scaffoldBackgroundColor,
                          padding: EdgeInsets.only(
                            bottom:
                                MediaQuery.of(context).viewInsets.bottom + 8,
                          ),
                          child: SafeArea(
                            top: false,
                            bottom: false,
                            child: InputBar(controller: _inputController),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onVerticalDragUpdate: (details) {
        setState(() {
          _isDragging = true;
          _animDuration = Duration.zero;
          _sheetHeight = (_sheetHeight - details.delta.dy).clamp(
            _minHeight,
            _maxHeight,
          );
        });
      },
      onVerticalDragEnd: (details) {
        _isDragging = false;
        final velocity = details.primaryVelocity ?? 0;
        final screenHeight = MediaQuery.of(context).size.height;
        final chatProvider = context.read<ChatProvider>();
        final hasUserMessages = chatProvider.messages.any((m) => m.isUser);

        if (velocity < -700 || _sheetHeight > screenHeight * 0.80) {
          _navigateToFullScreenChat();
        } else if (velocity > 400 || _sheetHeight < screenHeight * 0.22) {
          _dismissSheet();
        } else {
          setState(() {
            // Snap to either 45% or 68% based on state, or just let it stay if it's close
            final snap45 = screenHeight * 0.45;
            final snap68 = screenHeight * 0.68;
            
            if (hasUserMessages) {
              _sheetHeight = snap68;
            } else {
              _sheetHeight = (_sheetHeight > screenHeight * 0.55) ? snap68 : snap45;
            }
            _animDuration = const Duration(milliseconds: 300);
          });
        }
      },
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            decoration: BoxDecoration(
              color: Theme.of(
                context,
              ).scaffoldBackgroundColor.withValues(alpha: 0.9),
              border: Border(
                bottom: BorderSide(
                  color: Colors.grey.shade200.withValues(alpha: 0.5),
                  width: 0.5,
                ),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.grey[300],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              Padding(
                key: widget.headerKey,
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF98012).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.auto_awesome,
                        color: Color(0xFFF98012),
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _headerTitle,
                            style: GoogleFonts.inter(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFF1C1C1E),
                            ),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _headerSubtitle,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                              color: Colors.grey.shade600,
                            ),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 4),
                    IconButton(
                      icon: const Icon(Icons.add_comment_outlined, size: 20),
                      color: Colors.grey.shade500,
                      tooltip: 'New Session',
                      onPressed: () {
                        context.read<ChatProvider>().resetChat();
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      ),
    );
  }
}

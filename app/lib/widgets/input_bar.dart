import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:async';
import '../providers/chat_provider.dart';
import '../providers/app_context_provider.dart';
import '../models/app_context.dart';

class InputBar extends StatefulWidget {
  final TextEditingController? controller;
  const InputBar({super.key, this.controller});

  @override
  State<InputBar> createState() => _InputBarState();
}

class _InputBarState extends State<InputBar> {
  late final TextEditingController _controller;
  bool _isPressed = false;
  bool _hasText = false;
  int _hintIndex = 0;
  Timer? _hintTimer;

  final List<String> _generalHints = [
    'Ask your tutor anything...',
    'Summarize my notes...',
    'Explain this concept...',
    'Help me prepare for...',
  ];

  @override
  void initState() {
    super.initState();
    _controller = widget.controller ?? TextEditingController();
    _controller.addListener(_onTextChanged);
    _startHintRotation();
  }

  void _onTextChanged() {
    final hasText = _controller.text.trim().isNotEmpty;
    if (_hasText != hasText) {
      setState(() {
        _hasText = hasText;
      });
    }
  }

  void _startHintRotation() {
    _hintTimer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (mounted) {
        setState(() {
          _hintIndex = (_hintIndex + 1) % _generalHints.length;
        });
      }
    });
  }

  void _handleSend(ChatProvider provider, AppContext appContext) {
    final text = _controller.text.trim();
    if (text.isNotEmpty) {
      provider.sendMessage(text, appContext: appContext);
      _controller.clear();
    }
  }

  @override
  void dispose() {
    _hintTimer?.cancel();
    _controller.removeListener(_onTextChanged);
    if (widget.controller == null) {
      _controller.dispose();
    }
    super.dispose();
  }

  String _getContextualHint(AppContext contextState) {
    switch (contextState.screenType) {
      case ScreenType.courseDetails:
        return 'Ask about this subject...';
      case ScreenType.quiz:
        return 'Need a hint?';
      case ScreenType.assignments:
        return 'Help me with this assignment...';
      default:
        return _generalHints[_hintIndex];
    }
  }

  @override
  Widget build(BuildContext context) {
    final chatProvider = context.watch<ChatProvider>();
    final appContext = context.watch<AppContextProvider>().currentContext;
    final isStreaming = chatProvider.isStreaming;
    final canSend = _hasText && !isStreaming;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
        border: Border(top: BorderSide(color: Colors.grey.shade100)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF5F5F7),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  IconButton(
                    icon: Icon(
                      Icons.add_circle_outline,
                      color: Colors.grey.shade500,
                    ),
                    tooltip: 'Attach file or image',
                    padding: const EdgeInsets.all(12),
                    constraints: const BoxConstraints(),
                    onPressed: () {
                      // Handle attachment logic
                    },
                  ),
                  Expanded(
                    child: Consumer<AppContextProvider>(
                      builder: (context, provider, child) {
                        return TextField(
                          controller: _controller,
                          enabled: !isStreaming,
                          minLines: 1,
                          maxLines: 4,
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            color: const Color(0xFF1C1C1E),
                          ),
                          decoration: InputDecoration(
                            hintText: isStreaming
                                ? 'Mentor is thinking...'
                                : _getContextualHint(provider.currentContext),
                            hintStyle: GoogleFonts.inter(
                              fontSize: 15,
                              color: Colors.grey.shade400,
                            ),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.only(
                              top: 14,
                              bottom: 14,
                              right: 8,
                            ),
                          ),
                          onSubmitted: (_) =>
                              _handleSend(chatProvider, appContext),
                        );
                      },
                    ),
                  ),
                  if (!_hasText)
                    IconButton(
                      icon: Icon(Icons.mic_none, color: Colors.grey.shade500),
                      padding: const EdgeInsets.all(12),
                      constraints: const BoxConstraints(),
                      onPressed: () {
                        // Handle voice logic
                      },
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          Padding(
            padding: const EdgeInsets.only(
              bottom: 2,
            ), // Align with text field bottom
            child: GestureDetector(
              onTapDown: (_) {
                if (canSend) setState(() => _isPressed = true);
              },
              onTapUp: (_) {
                if (canSend) {
                  setState(() => _isPressed = false);
                  _handleSend(chatProvider, appContext);
                }
              },
              onTapCancel: () {
                if (canSend) setState(() => _isPressed = false);
              },
              child: AnimatedScale(
                scale: _isPressed ? 0.9 : 1.0,
                duration: const Duration(milliseconds: 100),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: canSend
                        ? const Color(0xFFF98012)
                        : Colors.grey.shade300,
                    shape: BoxShape.circle,
                    boxShadow: [
                      if (canSend)
                        BoxShadow(
                          color: const Color(0xFFF98012).withValues(alpha: 0.3),
                          blurRadius: 8,
                          offset: const Offset(0, 4),
                        ),
                    ],
                  ),
                  child: Icon(
                    Icons.arrow_upward_rounded,
                    color: canSend ? Colors.white : Colors.grey.shade500,
                    size: 22,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

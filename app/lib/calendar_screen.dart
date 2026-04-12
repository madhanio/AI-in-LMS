import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  late DateTime _currentMonth;
  late DateTime _today;

  @override
  void initState() {
    super.initState();
    _today = DateTime.now();
    _currentMonth = DateTime(_today.year, _today.month, 1);
  }

  void _previousMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1, 1);
    });
  }

  void _nextMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 1);
    });
  }

  @override
  Widget build(BuildContext context) {
    String monthYearHeader = DateFormat('MMMM yyyy').format(_currentMonth);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Calendar',
          style: TextStyle(color: Colors.black87, fontSize: 20, fontWeight: FontWeight.w500),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_alt_outlined, color: Colors.black87),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.more_vert, color: Colors.black87),
            onPressed: () {},
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Month Navigation
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios, size: 20),
                    onPressed: _previousMonth,
                  ),
                  Text(
                    monthYearHeader,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    icon: const Icon(Icons.arrow_forward_ios, size: 20),
                    onPressed: _nextMonth,
                  ),
                ],
              ),
            ),
            
            // Days of the week
            Container(
              padding: const EdgeInsets.symmetric(vertical: 8.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: const [
                  Text('Mon', style: TextStyle(fontWeight: FontWeight.bold)),
                  Text('Tue', style: TextStyle(fontWeight: FontWeight.bold)),
                  Text('Wed', style: TextStyle(fontWeight: FontWeight.bold)),
                  Text('Thu', style: TextStyle(fontWeight: FontWeight.bold)),
                  Text('Fri', style: TextStyle(fontWeight: FontWeight.bold)),
                  Text('Sat', style: TextStyle(fontWeight: FontWeight.bold)),
                  Text('Sun', style: TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            
            // Calendar Grid
            _buildCalendarGrid(),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {},
        backgroundColor: const Color(0xFFF98012),
        shape: const CircleBorder(),
        child: const Icon(Icons.add, color: Colors.black87, size: 32),
      ),
    );
  }

  Widget _buildCalendarGrid() {
    List<String> daysList = [];
    
    // Find the number of days in the month
    int daysInMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 0).day;
    
    // Determine the starting weekday (1 = Monday, 7 = Sunday)
    int startingWeekday = _currentMonth.weekday;

    // Pad with empty strings for days before the 1st of the month
    for (int i = 1; i < startingWeekday; i++) {
      daysList.add('');
    }

    // Add actual days
    for (int i = 1; i <= daysInMonth; i++) {
      daysList.add(i.toString());
    }

    // Pad the end to ensure the grid is full
    int remainingCells = 42 - daysList.length; // Max 6 rows * 7 columns
    if (daysList.length <= 35) {
      remainingCells = 35 - daysList.length; 
    }
    for (int i = 0; i < remainingCells; i++) {
      daysList.add('');
    }

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: daysList.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 7,
        childAspectRatio: 1.0,
      ),
      itemBuilder: (context, index) {
        String dayStr = daysList[index];
        bool isEmpty = dayStr.isEmpty;
        
        bool isToday = false;
        if (!isEmpty) {
          int dayInt = int.parse(dayStr);
          isToday = _today.day == dayInt && 
                    _today.month == _currentMonth.month && 
                    _today.year == _currentMonth.year;
        }

        return Container(
          decoration: BoxDecoration(
            color: isEmpty ? Colors.grey.shade50 : Colors.white,
            border: Border.all(color: Colors.grey.shade200, width: 0.5),
          ),
          alignment: Alignment.center,
          child: isToday
              ? Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFF98012), width: 2),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    dayStr,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                )
              : Text(
                  dayStr,
                  style: const TextStyle(fontSize: 16, color: Colors.black87),
                ),
        );
      },
    );
  }
}

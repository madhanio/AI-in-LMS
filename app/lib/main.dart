import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'calendar_screen.dart';
import 'ai_chat_screen.dart';
import 'providers/chat_provider.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ChatProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Moodle AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFF98012),
          primary: const Color(0xFFF98012),
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF8F9FA),
        fontFamily: 'Roboto', 
      ),
      home: const DashboardScreen(),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      endDrawer: _buildAccountDrawer(context),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Hyderabad Institute of ...',
          style: TextStyle(color: Colors.black, fontSize: 20, fontWeight: FontWeight.normal),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search, color: Colors.black, size: 28),
            onPressed: () {},
          ),
          Builder(
            builder: (context) => Padding(
              padding: const EdgeInsets.only(right: 16.0),
              child: InkWell(
                onTap: () => Scaffold.of(context).openEndDrawer(),
                child: CircleAvatar(
                  backgroundColor: Colors.purple[700],
                  radius: 18,
                  child: const Text(
                    'D',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
                  ),
                ),
              ),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.grey.shade300, width: 1)),
            ),
            child: TabBar(
              controller: _tabController,
              labelColor: Colors.black87,
              unselectedLabelColor: Colors.grey[600],
              indicatorColor: const Color(0xFFF98012),
              indicatorWeight: 3,
              labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              tabs: const [
                Tab(text: 'Dashboard'),
                Tab(text: 'Site home'),
              ],
            ),
          ),
        ),
      ),
      body: Stack(
        children: [
          TabBarView(
            controller: _tabController,
            children: [
              _buildDashboardTab(context),
              const Center(child: Text('Site home content')),
            ],
          ),
          // Floating arrow button on the right edge
          Positioned(
            right: -30, 
            top: MediaQuery.of(context).size.height / 2 - 120,
            child: Container(
              height: 80,
              width: 80,
              decoration: BoxDecoration(
                color: const Color(0xFFE5E7EB),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 4,
                    offset: const Offset(-2, 2),
                  ),
                ],
              ),
              child: const Align(
                alignment: Alignment.centerLeft,
                child: Padding(
                  padding: EdgeInsets.only(left: 12.0),
                  child: Icon(Icons.arrow_back_ios_new, size: 20, color: Colors.black87),
                ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const AiChatScreen()),
          );
        },
        backgroundColor: const Color(0xFFF98012),
        tooltip: 'AI Assistant',
        child: const Icon(Icons.smart_toy, color: Colors.white),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: Colors.grey.shade300, width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: (index) {
            setState(() {
              _selectedIndex = index;
            });
          },
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          selectedItemColor: const Color(0xFFF98012),
          unselectedItemColor: Colors.black87,
          showSelectedLabels: false,
          showUnselectedLabels: false,
          elevation: 0,
          items: [
            const BottomNavigationBarItem(
              icon: Icon(Icons.speed, size: 28),
              label: 'Dashboard',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.school, size: 28), 
              label: 'Site home',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.forum, size: 28), 
              label: 'Messages',
            ),
            BottomNavigationBarItem(
              icon: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.notifications, size: 28),
                  Positioned(
                    right: -4,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF98012),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 18,
                        minHeight: 18,
                      ),
                      child: const Center(
                        child: Text(
                          '3',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  )
                ],
              ),
              label: 'Notifications',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.more_horiz, size: 28), 
              label: 'More',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDashboardTab(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Timeline Card
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
              side: BorderSide(color: Colors.grey.shade300, width: 1),
            ),
            color: Colors.white,
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Timeline',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black87),
                  ),
                  const SizedBox(height: 16),
                  
                  // Search box in timeline
                  Container(
                    height: 44,
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade400),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Row(
                      children: [
                        const Expanded(
                          child: TextField(
                            decoration: InputDecoration(
                              hintText: 'Search by activity type or name',
                              hintStyle: TextStyle(color: Colors.grey, fontSize: 14),
                              border: InputBorder.none,
                              contentPadding: EdgeInsets.only(bottom: 12),
                            ),
                          ),
                        ),
                        const Icon(Icons.search, color: Colors.grey, size: 24),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade500,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Icon(Icons.close, color: Colors.white, size: 14),
                        )
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // Filter and Sort row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      PopupMenuButton<String>(
                        offset: const Offset(0, 40),
                        elevation: 4,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey.shade400),
                            borderRadius: BorderRadius.circular(4),
                            color: Colors.grey.shade100,
                          ),
                          child: Row(
                            children: const [
                              Text(
                                'Overdue', 
                                style: TextStyle(color: Colors.black87, fontWeight: FontWeight.w500, fontSize: 14),
                              ),
                              SizedBox(width: 8),
                              Icon(Icons.arrow_drop_up, color: Colors.black87, size: 20),
                            ],
                          ),
                        ),
                        itemBuilder: (context) => [
                          const PopupMenuItem(value: 'All', child: Text('All')),
                          PopupMenuItem(
                            value: 'Overdue', 
                            padding: EdgeInsets.zero,
                            child: Container(
                              width: double.infinity,
                              color: const Color(0xFFFDECDA),
                              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                              child: const Text('Overdue'),
                            ),
                          ),
                          const PopupMenuItem(
                            value: 'Due date', 
                            child: Text('Due date', style: TextStyle(color: Colors.grey)),
                          ),
                          const PopupMenuItem(value: 'Next 7 days', child: Text('Next 7 days')),
                          const PopupMenuItem(value: 'Next 30 days', child: Text('Next 30 days')),
                          const PopupMenuItem(value: 'Next 3 months', child: Text('Next 3 months')),
                          const PopupMenuItem(value: 'Next 6 months', child: Text('Next 6 months')),
                        ],
                      ),
                      const Icon(Icons.sort, color: Colors.black87),
                    ],
                  ),
                  
                  const SizedBox(height: 60),
                  
                  // Empty state image
                  Center(
                    child: Column(
                      children: [
                        Stack(
                          alignment: Alignment.bottomCenter,
                          children: [
                            Container(
                              width: 140,
                              height: 30,
                              margin: const EdgeInsets.only(bottom: 5),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0F0F0),
                                borderRadius: BorderRadius.circular(50),
                              ),
                            ),
                            Container(
                              width: 90,
                              height: 100,
                              color: const Color(0xFFB4B6BB),
                              margin: const EdgeInsets.only(bottom: 15),
                              padding: const EdgeInsets.all(10),
                              child: GridView.count(
                                crossAxisCount: 2,
                                mainAxisSpacing: 10,
                                crossAxisSpacing: 10,
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                children: List.generate(4, (index) => Container(
                                  color: const Color(0xFFE5E7EB),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Container(
                                        width: 14,
                                        height: 14,
                                        decoration: const BoxDecoration(
                                          color: Color(0xFFB4B6BB),
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Container(width: 16, height: 2, color: const Color(0xFFB4B6BB)),
                                      const SizedBox(height: 2),
                                      Container(width: 12, height: 2, color: const Color(0xFFB4B6BB)),
                                    ],
                                  ),
                                )),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        const Text(
                          'No activities require action',
                          style: TextStyle(fontSize: 16, color: Colors.black87),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
          
          const SizedBox(height: 16),
          
          // Calendar Card
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
              side: BorderSide(color: Colors.grey.shade300, width: 1),
            ),
            color: Colors.white,
            margin: EdgeInsets.zero,
            child: InkWell(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const CalendarScreen()),
                );
              },
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 20.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: const [
                    Text(
                      'Calendar',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black87),
                    ),
                    Icon(Icons.chevron_right, color: Colors.black87),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Account Drawer Implementation
  Widget _buildAccountDrawer(BuildContext context) {
    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'User account',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 28),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            
            // College Info
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Column(
                children: [
                  const Text(
                    'Hyderabad Institute of\nTechnology and Management',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 18, color: Colors.black54, fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 4),
                  TextButton(
                    onPressed: () {},
                    child: const Text(
                      'https://moodle.hitam.org',
                      style: TextStyle(fontSize: 16, color: Colors.blue),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            
            // User Profile Row
            ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              leading: CircleAvatar(
                backgroundColor: Colors.purple[700],
                radius: 24,
                child: const Text('D', style: TextStyle(color: Colors.white, fontSize: 20)),
              ),
              title: const Text('DEVULAPALLY SAI VIKAS'),
              subtitle: const Text('24E51A6739'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {},
            ),
            const Divider(height: 1),
            
            // Menu Items
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  _drawerItem(Icons.library_books, 'Grades'),
                  _drawerItem(Icons.folder, 'Files'),
                  _drawerItem(Icons.assignment, 'Reports'),
                  _drawerItem(Icons.emoji_events, 'Badges'),
                  _drawerItem(Icons.feed, 'Blog entries'),
                  const Divider(),
                  _drawerItem(Icons.build, 'Preferences'),
                  ListTile(
                    leading: const Icon(Icons.email, color: Colors.black54),
                    title: const Text('Contact site support', style: TextStyle(fontSize: 16)),
                    trailing: const Icon(Icons.open_in_new, size: 20),
                    onTap: () {},
                  ),
                  const Divider(),
                  _drawerItem(Icons.swap_horiz, 'Switch account'),
                ],
              ),
            ),
            
            // Log out button
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFC7362E), // Moodle red log out button
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                  ),
                  icon: const Icon(Icons.logout),
                  label: const Text('Log out', style: TextStyle(fontSize: 16)),
                  onPressed: () {},
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _drawerItem(IconData icon, String title) {
    return ListTile(
      leading: Icon(icon, color: Colors.black54),
      title: Text(title, style: const TextStyle(fontSize: 16)),
      trailing: const Icon(Icons.chevron_right),
      onTap: () {},
    );
  }
}

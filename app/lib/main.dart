import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'calendar_screen.dart';
import 'providers/chat_provider.dart';
import 'providers/app_context_provider.dart';
import 'widgets/ai/ai_overlay_layer.dart';
import 'models/app_context.dart';
import 'models/message.dart';

import 'package:supabase_flutter/supabase_flutter.dart';
import 'constants.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Hive.initFlutter();
  // Register Hive Adapters
  Hive.registerAdapter(ScreenTypeAdapter());
  Hive.registerAdapter(RestrictionFlagsAdapter());
  Hive.registerAdapter(CourseMetadataAdapter());
  Hive.registerAdapter(QuizMetadataAdapter());
  Hive.registerAdapter(GenericMetadataAdapter());
  Hive.registerAdapter(AppContextAdapter());
  Hive.registerAdapter(MessageAdapter());

  await Supabase.initialize(
    url: Constants.supabaseUrl,
    anonKey: Constants.supabaseAnonKey,
  );

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => ChatProvider(),
          lazy: false,
        ),
        ChangeNotifierProvider(
          create: (_) => AppContextProvider(),
        ),
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
      title: 'AcademicCore',
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
      home: const AiOverlayLayer(
        child: DashboardScreen(),
      ),
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
  final TextEditingController _searchController = TextEditingController();
  final ValueNotifier<bool> _isSearchEmpty = ValueNotifier(true);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) return;
      final contextProvider = context.read<AppContextProvider>();
      if (_tabController.index == 0) {
        contextProvider.updateContext(AppContext(
          screenType: ScreenType.dashboard,
          metadata: const GenericMetadata(title: 'Dashboard'),
        ));
      } else {
        contextProvider.updateContext(AppContext(
          screenType: ScreenType.general,
          metadata: const GenericMetadata(title: 'Site Home'),
        ));
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    _isSearchEmpty.dispose();
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
          'AcademicCore',
          style: const TextStyle(color: Colors.black, fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.5),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search, color: Colors.black, size: 24),
            onPressed: () {},
          ),
          Padding(
            padding: const EdgeInsets.only(right: 16.0),
            child: InkWell(
              onTap: () => Scaffold.of(context).openEndDrawer(),
              child: CircleAvatar(
                backgroundColor: Colors.purple[700],
                radius: 16,
                child: const Text(
                  'A',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
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
              labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              tabs: const [
                Tab(text: 'Dashboard'),
                Tab(text: 'Site home'),
              ],
            ),
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildDashboardTab(context),
          const Center(child: Text('Site home content')),
        ],
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
            final contextProvider = context.read<AppContextProvider>();
            switch (index) {
              case 0:
                contextProvider.updateContext(AppContext(
                  screenType: ScreenType.dashboard,
                  metadata: const GenericMetadata(title: 'Dashboard'),
                ));
                break;
              case 1:
                contextProvider.updateContext(AppContext(
                  screenType: ScreenType.general,
                  metadata: const GenericMetadata(title: 'Site Home'),
                ));
                break;
              case 2:
              case 3:
              case 4:
                contextProvider.updateContext(AppContext(
                  screenType: ScreenType.general,
                  metadata: const GenericMetadata(title: 'Menu'),
                ));
                break;
            }
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
              icon: Icon(Icons.speed, size: 24),
              label: 'Dashboard',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.school, size: 24), 
              label: 'Site home',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.forum, size: 24), 
              label: 'Messages',
            ),
            BottomNavigationBarItem(
              icon: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.notifications, size: 24),
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
              icon: Icon(Icons.more_horiz, size: 24), 
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
                        Expanded(
                          child: TextField(
                            controller: _searchController,
                            onChanged: (val) => _isSearchEmpty.value = val.isEmpty,
                            decoration: const InputDecoration(
                              hintText: 'Search by activity type or name',
                              hintStyle: TextStyle(color: Colors.grey, fontSize: 14),
                              border: InputBorder.none,
                              contentPadding: EdgeInsets.only(bottom: 12),
                            ),
                          ),
                        ),
                        const Icon(Icons.search, color: Colors.grey, size: 24),
                        const SizedBox(width: 8),
                        ValueListenableBuilder<bool>(
                          valueListenable: _isSearchEmpty,
                          builder: (context, isEmpty, child) {
                            if (isEmpty) return const SizedBox.shrink();
                            return GestureDetector(
                              onTap: () {
                                _searchController.clear();
                                _isSearchEmpty.value = true;
                              },
                              child: Container(
                                padding: const EdgeInsets.all(2),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade500,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: const Icon(Icons.close, color: Colors.white, size: 14),
                              ),
                            );
                          },
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
                          'No overdue activities',
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
            
            // Static Admin Profile Row
            ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              leading: CircleAvatar(
                backgroundColor: Colors.purple[700],
                radius: 24,
                child: const Text('A', style: TextStyle(color: Colors.white, fontSize: 20)),
              ),
              title: const Text('Admin'),
              subtitle: const Text('Data Science'),
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

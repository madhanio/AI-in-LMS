import 'package:flutter/material.dart';
import 'login_screen.dart';

class ConnectSiteScreen extends StatefulWidget {
  const ConnectSiteScreen({super.key});

  @override
  State<ConnectSiteScreen> createState() => _ConnectSiteScreenState();
}

class _ConnectSiteScreenState extends State<ConnectSiteScreen> {
  final _siteCtrl = TextEditingController(text: 'https://campus.example.edu');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () {}, // Optional basically back to a previous intro screen if any
        ),
        title: const Text(
          'Connect to Moodle',
          style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.black87),
            onPressed: () {},
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            const SizedBox(height: 48),
            // Moodle Logo Replica using Asset or matching colors
            // Since we have assets/moodle.png, we can use that!
            Image.asset(
              'assets/moodle.png',
              height: 100,
              errorBuilder: (_, __, ___) => const Icon(Icons.school, size: 80, color: Color(0xFFF98012)),
            ),
            
            const SizedBox(height: 48),
            
            // Site input
            TextField(
              controller: _siteCtrl,
              decoration: const InputDecoration(
                labelText: 'Your site',
                floatingLabelBehavior: FloatingLabelBehavior.always,
                border: UnderlineInputBorder(),
              ),
              onSubmitted: (value) {
                // Ignore validation for clone sake and proceed straight to login credentials
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              },
            ),
            const SizedBox(height: 32),
            
            const Text('Or', style: TextStyle(fontSize: 16, color: Colors.black87)),
            const SizedBox(height: 32),
            
            // Scan QR Button
            OutlinedButton.icon(
              onPressed: () {
                // Navigate to standard login directly as fallback for demonstration
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              },
              icon: const Icon(Icons.qr_code_scanner, color: Colors.black87),
              label: const Text('Scan QR code', style: TextStyle(color: Colors.black87, fontSize: 16)),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                minimumSize: const Size(double.infinity, 50),
                side: const BorderSide(color: Colors.grey),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
              ),
            ),
            
            const SizedBox(height: 32),
            
            TextButton(
              onPressed: () {},
              child: const Text(
                'Need help?',
                style: TextStyle(
                  color: Colors.black87, 
                  fontSize: 16, 
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

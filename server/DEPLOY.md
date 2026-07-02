# Deployment Guide: AWS EC2 (PM2 & Application Load Balancer)

This guide documents the step-by-step instructions to deploy the Node.js backend on a fresh AWS EC2 instance running Ubuntu or Amazon Linux, configured behind an Application Load Balancer (ALB).

---

## 1. System Requirements & Port Configuration
- Ensure your EC2 Security Group allows inbound traffic on:
  - **TCP Port 22** (SSH access)
  - **TCP Port 3000** (or whatever port you set in `.env` / ALB target group route)
- Set up your Application Load Balancer (ALB) to forward HTTP/HTTPS traffic to the EC2 target group on port `3000`.

---

## 2. Install Node.js & Git

### For Ubuntu (22.04 LTS or newer)
```bash
# Update package lists
sudo apt-get update -y

# Install Git
sudo apt-get install git -y

# Install Node.js (NodeSource Node.js v20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installations
node -v  # Expected: v20.x.x
npm -v
```

### For Amazon Linux 2023
```bash
# Update package lists
sudo dnf update -y

# Install Git
sudo dnf install git -y

# Install Node.js 20
sudo dnf install -y nodejs

# Verify installations
node -v  # Expected: v20.x.x
npm -v
```

---

## 3. Clone and Set Up the Repository

```bash
# Clone the repository (replace with your repository URL)
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name/server

# Install Node dependencies
npm install

# (Optional) Install python dependencies if required by package.json
# pip3 install -r requirements.txt
```

---

## 4. Environment Variables Configuration

Create a `.env` file using the template provided:
```bash
cp .env.example .env
nano .env
```
Fill in the configuration details:
- Set `PORT=3000`.
- Populate Supabase and NVIDIA API keys.

---

## 5. Install & Run with PM2

PM2 manages the server as a background process and handles auto-restarts on crash.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application using the ecosystem config file
pm2 start ecosystem.config.js

# Enable PM2 to start on system boot
pm2 startup
# (Copy and paste the command output by the terminal from the step above to configure the systemd unit)

# Save the current PM2 process list so it recovers on reboot
pm2 save
```

### PM2 Commands cheat sheet
- View running apps: `pm2 list`
- View real-time logs: `pm2 logs`
- Restart app: `pm2 restart moodle-ai-backend`
- Stop app: `pm2 stop moodle-ai-backend`

---

## 6. Load Balancer Integration
Configure your ALB target group:
- **Target Type**: Instance
- **Protocol**: HTTP
- **Port**: 3000
- **Health Check Path**: `/health` (Expected Success Code: 200)

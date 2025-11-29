#!/bin/bash
# MyKeys VM Setup Script

set -e

echo "=== MyKeys Secrets Manager Setup ==="
echo "Starting installation..."

# Update system
echo "Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install Node.js 20.x
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
echo "Installing Nginx..."
sudo apt install -y nginx

# Install PM2 for process management
echo "Installing PM2..."
sudo npm install -g pm2

# Create application directory
echo "Creating application directory..."
sudo mkdir -p /var/www/mykeys
sudo chown -R $USER:$USER /var/www/mykeys

# Create logs directory
sudo mkdir -p /var/log/mykeys
sudo chown -R $USER:$USER /var/log/mykeys

# Install application (files will be uploaded separately)
echo "Application directory ready at /var/www/mykeys"

# Configure PM2 to start on boot
sudo pm2 startup systemd -u $USER --hp /home/$USER

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Next steps:"
echo "1. Upload application files to /var/www/mykeys/"
echo "2. Run: cd /var/www/mykeys && npm install"
echo "3. Start app: pm2 start server.js --name mykeys"
echo "4. Save PM2 config: pm2 save"
echo "5. Configure Nginx reverse proxy"

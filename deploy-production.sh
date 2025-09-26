#!/bin/bash

# ============================================================================= 
# UAV Dashboard Server - Production Deployment Script
# 
# SECURITY & PERFORMANCE FIXED VERSION
# This script automates the secure deployment of the UAV Dashboard Server
# with all security fixes and performance optimizations applied.
#
# @author KRTI Team
# @version 3.1.0
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="uav-dashboard-server"
SERVICE_USER="uav-service"
INSTALL_DIR="/opt/uav-dashboard"
LOG_DIR="/var/log/uav-dashboard"
PID_FILE="/var/run/uav-dashboard.pid"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}===================================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}===================================================${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Create system user for the service
create_service_user() {
    print_status "Creating service user: $SERVICE_USER"
    
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd -r -s /bin/false -d $INSTALL_DIR $SERVICE_USER
        print_status "Created user: $SERVICE_USER"
    else
        print_warning "User $SERVICE_USER already exists"
    fi
}

# Install system dependencies
install_dependencies() {
    print_status "Installing system dependencies..."
    
    # Update system packages
    apt-get update -qq
    
    # Install required packages
    apt-get install -y \
        curl \
        gnupg \
        software-properties-common \
        nginx \
        fail2ban \
        ufw \
        logrotate \
        certbot \
        python3-certbot-nginx
    
    # Install Node.js (LTS version)
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    apt-get install -y nodejs
    
    # Install PM2 globally for process management
    npm install -g pm2
    
    print_status "System dependencies installed successfully"
}

# Setup directories and permissions
setup_directories() {
    print_status "Setting up directories and permissions..."
    
    # Create directories
    mkdir -p $INSTALL_DIR
    mkdir -p $LOG_DIR
    mkdir -p /etc/uav-dashboard
    
    # Set ownership
    chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR
    chown -R $SERVICE_USER:$SERVICE_USER $LOG_DIR
    
    # Set permissions
    chmod 755 $INSTALL_DIR
    chmod 755 $LOG_DIR
    chmod 644 /etc/uav-dashboard
    
    print_status "Directories created and permissions set"
}

# Install Node.js application
install_application() {
    print_status "Installing UAV Dashboard Server application..."
    
    # Copy application files
    cp server_fixed.js $INSTALL_DIR/
    cp package_fixed.json $INSTALL_DIR/package.json
    cp .env.example $INSTALL_DIR/
    
    # Copy web assets
    cp index.html $INSTALL_DIR/
    cp script.js $INSTALL_DIR/
    cp style.css $INSTALL_DIR/
    
    # Copy directories
    if [ -d "assets" ]; then
        cp -r assets $INSTALL_DIR/
    fi
    
    if [ -d "animations" ]; then
        cp -r animations $INSTALL_DIR/
    fi
    
    # Change to install directory and install dependencies
    cd $INSTALL_DIR
    
    # Set ownership for npm install
    chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR
    
    # Install production dependencies as service user
    sudo -u $SERVICE_USER npm install --production
    
    print_status "Application installed successfully"
}

# Configure environment variables
configure_environment() {
    print_status "Configuring environment variables..."
    
    # Create production environment file
    cat > /etc/uav-dashboard/production.env << EOF
NODE_ENV=production
PORT=3003

# Security Configuration
ALLOWED_ORIGINS=http://localhost:3003,https://yourdomain.com
JWT_SECRET=$(openssl rand -base64 32)
MAX_CONNECTIONS_PER_IP=10
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# Telemetry Configuration  
CONNECTION_TIMEOUT=15000
MONITOR_INTERVAL=5000
MAX_HISTORY_SIZE=1000
MAX_PAYLOAD_SIZE=1024
DEDUP_WINDOW_MS=5000

# Dummy Data (disabled in production)
DUMMY_DATA_ENABLED=false

# Performance Configuration
MAX_CONCURRENT_REQUESTS=100
MEMORY_LIMIT_MB=512
CPU_LIMIT_PERCENT=80

# Monitoring
HEALTH_CHECK_ENABLED=true
MEMORY_ALERT_THRESHOLD=80
CPU_ALERT_THRESHOLD=85
ERROR_RATE_THRESHOLD=5

# Logging
LOG_LEVEL=info
LOG_RETENTION_DAYS=7
EOF
    
    # Set permissions
    chown root:$SERVICE_USER /etc/uav-dashboard/production.env
    chmod 640 /etc/uav-dashboard/production.env
    
    print_status "Environment configuration created"
}

# Setup PM2 ecosystem configuration
setup_pm2() {
    print_status "Setting up PM2 process management..."
    
    cat > $INSTALL_DIR/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'uav-dashboard',
    script: 'server_fixed.js',
    cwd: '/opt/uav-dashboard',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production'
    },
    env_file: '/etc/uav-dashboard/production.env',
    error_file: '/var/log/uav-dashboard/error.log',
    out_file: '/var/log/uav-dashboard/output.log',
    log_file: '/var/log/uav-dashboard/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Monitoring & Health checks
    min_uptime: '10s',
    max_restarts: 10,
    
    // Advanced PM2 features
    kill_timeout: 5000,
    listen_timeout: 3000,
    shutdown_with_message: true,
    
    // Process management
    uid: 'uav-service',
    gid: 'uav-service'
  }],
  
  deploy: {
    production: {
      user: 'uav-service',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:your-org/uav-dashboard.git',
      path: '/opt/uav-dashboard',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production'
    }
  }
};
EOF
    
    chown $SERVICE_USER:$SERVICE_USER $INSTALL_DIR/ecosystem.config.js
    
    print_status "PM2 configuration created"
}

# Configure Nginx reverse proxy
setup_nginx() {
    print_status "Configuring Nginx reverse proxy..."
    
    cat > /etc/nginx/sites-available/uav-dashboard << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy strict-origin-when-cross-origin;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=websocket:10m rate=100r/m;
    
    # Main application
    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # API endpoints with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # API specific headers
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    # WebSocket endpoints
    location /socket.io/ {
        limit_req zone=websocket burst=50 nodelay;
        
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://127.0.0.1:3003;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Security: Block access to sensitive files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~ \.(env|config)$ {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/uav-dashboard /etc/nginx/sites-enabled/
    
    # Remove default site if exists
    rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    nginx -t
    
    print_status "Nginx configuration created"
}

# Configure firewall
setup_firewall() {
    print_status "Configuring UFW firewall..."
    
    # Reset firewall rules
    ufw --force reset
    
    # Default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH (be careful not to lock yourself out!)
    ufw allow ssh
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow application port (for debugging if needed)
    # ufw allow 3003/tcp
    
    # Enable firewall
    ufw --force enable
    
    print_status "Firewall configured"
}

# Configure fail2ban for additional security
setup_fail2ban() {
    print_status "Configuring Fail2Ban..."
    
    cat > /etc/fail2ban/jail.d/uav-dashboard.conf << 'EOF'
[nginx-uav]
enabled = true
port = http,https
filter = nginx-uav
logpath = /var/log/nginx/access.log
maxretry = 5
bantime = 3600
findtime = 600

[uav-api-abuse]
enabled = true
port = http,https
filter = uav-api-abuse
logpath = /var/log/uav-dashboard/combined.log
maxretry = 10
bantime = 1800
findtime = 300
EOF

    cat > /etc/fail2ban/filter.d/nginx-uav.conf << 'EOF'
[Definition]
failregex = ^<HOST> -.*"(GET|POST).*" (4\d\d|5\d\d) .*$
ignoreregex = ^<HOST> -.*"(GET|POST).*(robots\.txt|favicon\.ico).*" .*$
EOF

    cat > /etc/fail2ban/filter.d/uav-api-abuse.conf << 'EOF'
[Definition]
failregex = .*Rate limit exceeded.*ip: <HOST>.*
            .*Authentication failed.*ip: <HOST>.*
            .*Invalid.*data.*ip: <HOST>.*
ignoreregex =
EOF
    
    systemctl enable fail2ban
    systemctl restart fail2ban
    
    print_status "Fail2Ban configured"
}

# Setup log rotation
setup_logrotate() {
    print_status "Configuring log rotation..."
    
    cat > /etc/logrotate.d/uav-dashboard << 'EOF'
/var/log/uav-dashboard/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 uav-service uav-service
    postrotate
        /usr/bin/pm2 reloadLogs
    endscript
}

/var/log/nginx/access.log /var/log/nginx/error.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data adm
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}
EOF
    
    print_status "Log rotation configured"
}

# Create systemd service
create_systemd_service() {
    print_status "Creating systemd service..."
    
    cat > /etc/systemd/system/uav-dashboard.service << 'EOF'
[Unit]
Description=UAV Dashboard Server - Security & Performance Fixed
After=network.target
Wants=network.target

[Service]
Type=forking
User=uav-service
Group=uav-service
WorkingDirectory=/opt/uav-dashboard
Environment=NODE_ENV=production
EnvironmentFile=/etc/uav-dashboard/production.env
ExecStart=/usr/bin/pm2 start ecosystem.config.js --no-daemon
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 kill
PIDFile=/var/run/uav-dashboard.pid

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/uav-dashboard /var/log/uav-dashboard /var/run

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

# Restart policy
Restart=always
RestartSec=10
StartLimitInterval=60s
StartLimitBurst=3

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable uav-dashboard
    
    print_status "Systemd service created"
}

# Setup SSL certificate with Let's Encrypt
setup_ssl() {
    print_warning "SSL setup requires a valid domain name"
    print_status "To setup SSL after deployment, run:"
    print_status "  certbot --nginx -d yourdomain.com -d www.yourdomain.com"
    print_status "  systemctl enable certbot.timer"
}

# Setup monitoring script
setup_monitoring() {
    print_status "Setting up monitoring scripts..."
    
    cat > /opt/uav-dashboard/monitor.sh << 'EOF'
#!/bin/bash

# UAV Dashboard Server Monitoring Script

LOG_FILE="/var/log/uav-dashboard/monitor.log"
HEALTH_URL="http://localhost:3003/api/health"
ALERT_EMAIL="admin@yourdomain.com"

# Function to log with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

# Check if service is running
check_service() {
    if ! systemctl is-active --quiet uav-dashboard; then
        log_message "ERROR: UAV Dashboard service is not running"
        systemctl restart uav-dashboard
        log_message "INFO: Attempted to restart UAV Dashboard service"
        return 1
    fi
    return 0
}

# Check health endpoint
check_health() {
    response=$(curl -s -w "%{http_code}" -o /tmp/health_check.json $HEALTH_URL)
    http_code="${response: -3}"
    
    if [ "$http_code" != "200" ]; then
        log_message "ERROR: Health check failed with HTTP $http_code"
        return 1
    fi
    
    # Check memory usage
    memory_percent=$(jq -r '.memory.heapUsed' /tmp/health_check.json 2>/dev/null)
    if [ "$memory_percent" != "null" ] && [ "$memory_percent" -gt 400000000 ]; then  # 400MB
        log_message "WARNING: High memory usage detected: $memory_percent bytes"
    fi
    
    return 0
}

# Main monitoring function
main() {
    if check_service && check_health; then
        log_message "INFO: All checks passed"
        exit 0
    else
        log_message "ERROR: Monitoring checks failed"
        exit 1
    fi
}

main
EOF
    
    chmod +x /opt/uav-dashboard/monitor.sh
    chown $SERVICE_USER:$SERVICE_USER /opt/uav-dashboard/monitor.sh
    
    # Setup cron job for monitoring
    cat > /etc/cron.d/uav-dashboard-monitor << 'EOF'
# UAV Dashboard Server Monitoring
*/5 * * * * uav-service /opt/uav-dashboard/monitor.sh
EOF
    
    print_status "Monitoring script configured"
}

# Start services
start_services() {
    print_status "Starting services..."
    
    # Start and enable services
    systemctl restart nginx
    systemctl enable nginx
    
    # Start application via PM2 as service user
    cd $INSTALL_DIR
    sudo -u $SERVICE_USER pm2 start ecosystem.config.js
    sudo -u $SERVICE_USER pm2 save
    
    # Start systemd service
    systemctl start uav-dashboard
    
    print_status "Services started successfully"
}

# Verify installation
verify_installation() {
    print_status "Verifying installation..."
    
    # Check service status
    if systemctl is-active --quiet uav-dashboard; then
        print_status "✅ UAV Dashboard service is running"
    else
        print_error "❌ UAV Dashboard service failed to start"
        return 1
    fi
    
    # Check Nginx
    if systemctl is-active --quiet nginx; then
        print_status "✅ Nginx is running"
    else
        print_error "❌ Nginx failed to start"
        return 1
    fi
    
    # Check health endpoint
    sleep 5
    if curl -s http://localhost:3003/api/health | grep -q "healthy"; then
        print_status "✅ Health check passed"
    else
        print_error "❌ Health check failed"
        return 1
    fi
    
    print_status "Installation verification completed successfully"
}

# Cleanup function
cleanup() {
    print_status "Cleaning up temporary files..."
    rm -f /tmp/health_check.json
}

# Main installation function
main() {
    print_header "UAV Dashboard Server - Production Deployment"
    print_status "Starting deployment of Security & Performance Fixed Version..."
    
    # Pre-checks
    check_root
    
    # Installation steps
    create_service_user
    install_dependencies
    setup_directories
    install_application
    configure_environment
    setup_pm2
    setup_nginx
    setup_firewall
    setup_fail2ban
    setup_logrotate
    create_systemd_service
    setup_monitoring
    start_services
    
    # Verification
    verify_installation
    
    # Cleanup
    cleanup
    
    # Success message
    print_header "DEPLOYMENT COMPLETED SUCCESSFULLY!"
    
    echo ""
    print_status "🚀 UAV Dashboard Server is now running with security fixes applied!"
    echo ""
    print_status "📊 Access your dashboard at: http://$(hostname -I | awk '{print $1}')/"
    print_status "🔒 Security features enabled: CORS whitelist, rate limiting, input validation"
    print_status "🛡️  Monitoring: Health checks, circuit breakers, memory monitoring"
    print_status "📈 Performance: Optimized with deduplication, async processing"
    echo ""
    
    print_warning "IMPORTANT NEXT STEPS:"
    print_warning "1. Update /etc/uav-dashboard/production.env with your specific settings"
    print_warning "2. Configure your domain in Nginx: /etc/nginx/sites-available/uav-dashboard"
    print_warning "3. Setup SSL certificate: certbot --nginx -d yourdomain.com"
    print_warning "4. Update ALLOWED_ORIGINS in production.env for your domain"
    print_warning "5. Change default JWT_SECRET to a secure random value"
    echo ""
    
    print_status "📋 Log files:"
    print_status "   Application: /var/log/uav-dashboard/"
    print_status "   Nginx: /var/log/nginx/"
    print_status "   System: journalctl -u uav-dashboard -f"
    echo ""
    
    print_status "🔧 Management commands:"
    print_status "   Start:   systemctl start uav-dashboard"
    print_status "   Stop:    systemctl stop uav-dashboard"
    print_status "   Status:  systemctl status uav-dashboard"
    print_status "   Logs:    journalctl -u uav-dashboard -f"
    print_status "   Monitor: pm2 monit"
    echo ""
    
    print_status "✅ Production deployment completed successfully!"
}

# Run main function
main "$@"

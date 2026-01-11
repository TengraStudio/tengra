#!/bin/bash
# Linux Service Installer for Orbit Token Refresh Service
#
# This script installs the token refresh service as a systemd service on Linux.
#
# Usage:
#   sudo ./scripts/install-service-linux.sh install   - Install service
#   sudo ./scripts/install-service-linux.sh uninstall - Uninstall service

set -e

SERVICE_NAME="orbit-token-refresh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
USER="${SUDO_USER:-$USER}"

install_service() {
    echo "Installing Orbit Token Refresh Service..."
    
    # Check if service already exists
    if systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
        echo "Service already exists. Stopping it first..."
        systemctl stop "${SERVICE_NAME}" || true
        systemctl disable "${SERVICE_NAME}" || true
    fi
    
    # Create service file
    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Orbit Token Refresh Service - Automatically refreshes authentication tokens
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${PROJECT_ROOT}
ExecStart=/usr/bin/node ${PROJECT_ROOT}/scripts/token-refresh-service.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=orbit-token-refresh

# Environment variables
Environment="NODE_ENV=production"
Environment="ORBIT_PROXY_PORT=8317"

# Security settings
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd
    systemctl daemon-reload
    
    # Enable and start service
    systemctl enable "${SERVICE_NAME}"
    systemctl start "${SERVICE_NAME}"
    
    echo "Service installed and started successfully!"
    echo ""
    echo "To manage the service:"
    echo "  Start:   sudo systemctl start ${SERVICE_NAME}"
    echo "  Stop:    sudo systemctl stop ${SERVICE_NAME}"
    echo "  Status:  sudo systemctl status ${SERVICE_NAME}"
    echo "  Logs:    sudo journalctl -u ${SERVICE_NAME} -f"
}

uninstall_service() {
    echo "Uninstalling Orbit Token Refresh Service..."
    
    if systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"; then
        systemctl stop "${SERVICE_NAME}" || true
        systemctl disable "${SERVICE_NAME}" || true
        rm -f "$SERVICE_FILE"
        systemctl daemon-reload
        echo "Service uninstalled successfully!"
    else
        echo "Service is not installed."
    fi
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Parse command
case "${1:-}" in
    install)
        install_service
        ;;
    uninstall)
        uninstall_service
        ;;
    *)
        echo "Usage:"
        echo "  sudo $0 install   - Install service"
        echo "  sudo $0 uninstall - Uninstall service"
        exit 1
        ;;
esac

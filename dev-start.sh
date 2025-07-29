#!/bin/bash
set -e

echo "🚀 Starting CMUX Development Environment"

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install --frozen-lockfile
fi

# Start Convex backend services
echo "🔧 Starting Convex backend services..."
cd .devcontainer
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Check if services are running
echo "✅ Checking service status..."
docker-compose ps

echo "🎉 Development environment ready!"
echo ""
echo "Available services:"
echo "  - Convex Backend: http://localhost:9777"
echo "  - Convex Dashboard: http://localhost:6791"
echo "  - Frontend (when started): http://localhost:5173"
echo ""
echo "To start the frontend, run: pnpm dev"
echo "To stop services, run: cd .devcontainer && docker-compose down"

# Daytona DevContainer Example

This is an example Node.js application that demonstrates using Daytona with DevContainers, PostgreSQL, and Redis.

## Features

- Express.js REST API
- PostgreSQL for persistent storage
- Redis for caching
- DevContainer configuration for consistent development environment

## API Endpoints

- `GET /` - Records a visit and returns total visit count
- `GET /stats` - Returns recent visits and statistics
- `GET /health` - Health check endpoint for all services

## Running Locally

1. Install Docker and Docker Compose
2. Run `docker-compose up` in the `.devcontainer` directory
3. The app will be available at http://localhost:3000
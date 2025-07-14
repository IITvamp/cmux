const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
app.use(express.json());

// PostgreSQL connection
const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: 5432,
  user: process.env.POSTGRES_USER || 'devuser',
  password: process.env.POSTGRES_PASSWORD || 'devpass',
  database: process.env.POSTGRES_DB || 'devdb'
});

// Redis connection
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379
  }
});

// Connect to Redis
redisClient.connect().catch(console.error);

// Initialize database
async function initDB() {
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        path VARCHAR(255)
      )
    `);
    console.log('Database initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

initDB();

// Routes
app.get('/', async (req, res) => {
  try {
    // Record visit in PostgreSQL
    await pgPool.query('INSERT INTO visits (path) VALUES ($1)', [req.path]);
    
    // Increment counter in Redis
    const count = await redisClient.incr('visit_count');
    
    res.json({
      message: 'Hello from Daytona DevContainer!',
      totalVisits: count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/stats', async (req, res) => {
  try {
    // Get recent visits from PostgreSQL
    const result = await pgPool.query(
      'SELECT * FROM visits ORDER BY timestamp DESC LIMIT 10'
    );
    
    // Get total count from Redis
    const totalCount = await redisClient.get('visit_count') || '0';
    
    res.json({
      totalVisits: parseInt(totalCount),
      recentVisits: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', async (req, res) => {
  try {
    // Check PostgreSQL
    await pgPool.query('SELECT 1');
    
    // Check Redis
    await redisClient.ping();
    
    res.json({
      status: 'healthy',
      services: {
        postgres: 'connected',
        redis: 'connected'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pgPool.end();
  await redisClient.quit();
  process.exit(0);
});
#!/usr/bin/env node

import { Command } from 'commander';
import { startServer } from './index.js';
import path from 'path';

const program = new Command();

program
  .name('cmux')
  .description('Socket.IO and static file server')
  .version('0.1.1')
  .option('-p, --port <port>', 'port to listen on', '2689')
  .option('-d, --dir <directory>', 'static files directory', './public')
  .option('-c, --cors <origin>', 'CORS origin configuration', 'true')
  .action((options) => {
    const port = parseInt(options.port);
    const staticDir = path.resolve(options.dir);
    const corsOrigin = options.cors === 'true' ? true : options.cors === 'false' ? false : options.cors;

    startServer({
      port,
      staticDir,
      corsOrigin
    });

    process.on('SIGINT', () => {
      console.log('\nShutting down server...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\nShutting down server...');
      process.exit(0);
    });
  });

program.parse();
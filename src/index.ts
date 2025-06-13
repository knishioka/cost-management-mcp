#!/usr/bin/env node
import { startServer } from './server';

startServer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
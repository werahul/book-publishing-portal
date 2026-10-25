import { Router } from 'express';
import mongoose from 'mongoose';
import { Errors } from '../../lib/app-error';

export const healthRouter = Router();

// The host's health check polls this, so it reports unhealthy when MongoDB is unreachable.
healthRouter.get('/', (_req, res) => {
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected) {
    throw Errors.serviceUnavailable('Database unavailable');
  }
  res.json({ data: { status: 'ok', db: 'up', uptime: process.uptime() } });
});

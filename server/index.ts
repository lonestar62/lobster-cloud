import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth';
import locationRoutes from './routes/location';
import nodesRoutes from './routes/nodes';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', authRoutes);
app.use('/api', locationRoutes);
app.use('/api/nodes', nodesRoutes);
app.use('/admin', adminRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'lobster-cloud',
    time: new Date().toISOString(),
  });
});

// Serve built client apps in production
if (process.env.NODE_ENV === 'production') {
  app.use('/app', express.static(path.join(__dirname, '../client/app/dist')));
  app.use('/admin-portal', express.static(path.join(__dirname, '../client/admin/dist')));
  app.get('/app/*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../client/app/dist/index.html'));
  });
  app.get('/admin-portal/*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../client/admin/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🦞 Lobster Cloud API running on http://localhost:${PORT}`);
  console.log(`   /health       — health check`);
  console.log(`   /api/register — user registration`);
  console.log(`   /api/login    — user login`);
  console.log(`   /admin/login  — admin login`);
});

export default app;

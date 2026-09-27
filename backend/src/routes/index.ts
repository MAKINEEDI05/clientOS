import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireDemoToken } from '../middleware/demoToken.js';
import * as health from '../controllers/health.controller.js';
import * as clients from '../controllers/clients.controller.js';
import * as projects from '../controllers/projects.controller.js';
import * as agent from '../controllers/agent.controller.js';
import * as conflicts from '../controllers/conflicts.controller.js';
import * as interactions from '../controllers/interactions.controller.js';
import * as demo from '../controllers/demo.controller.js';
import * as memory from '../controllers/memory.controller.js';

/**
 * All ClientOS routes. Handlers live in controllers; controllers delegate to
 * services; services own Hindsight, Groq and PostgreSQL access. No business
 * logic lives in this file.
 */
export const apiRouter = Router();

// --- Health ---
apiRouter.get('/health', asyncHandler(health.getHealth));
apiRouter.get('/health/hindsight', asyncHandler(health.getHindsightHealth));

// --- Clients ---
apiRouter.get('/clients', asyncHandler(clients.listClients));
apiRouter.post('/clients', asyncHandler(clients.postClient));
apiRouter.get('/clients/:clientId', asyncHandler(clients.getClient));
apiRouter.get('/clients/:clientId/memory', asyncHandler(clients.getClientMemory));
apiRouter.get('/clients/:clientId/conflicts', asyncHandler(clients.getClientConflicts));
apiRouter.post('/clients/:clientId/projects', asyncHandler(projects.postClientProject));

// --- Projects ---
apiRouter.get('/projects/:projectId', asyncHandler(projects.getProject));
apiRouter.get('/projects/:projectId/interactions', asyncHandler(projects.listProjectInteractions));
apiRouter.post('/projects/:projectId/interactions', asyncHandler(projects.createProjectInteraction));
apiRouter.get('/projects/:projectId/memory', asyncHandler(projects.getProjectMemory));
apiRouter.get('/projects/:projectId/conflicts', asyncHandler(projects.getProjectConflicts));

// --- Interactions ---
apiRouter.post('/interactions/:interactionId/retry-retain', asyncHandler(interactions.postRetryRetain));

// --- Memory curation (retire / restore; never deletes) ---
apiRouter.post('/memories/:memoryId/invalidate', asyncHandler(memory.postInvalidateMemory));
apiRouter.post('/memories/:memoryId/restore', asyncHandler(memory.postRestoreMemory));

// --- Agent ---
apiRouter.post('/agent/recommend', asyncHandler(agent.postRecommend));
apiRouter.get('/agent/recommendations/:recommendationId', asyncHandler(agent.getRecommendation));
apiRouter.post(
  '/agent/recommendations/:recommendationId/feedback',
  asyncHandler(agent.postFeedback),
);

// --- Conflicts ---
apiRouter.get('/conflicts/:conflictId', asyncHandler(conflicts.getConflict));
apiRouter.post('/conflicts/:conflictId/resolve', asyncHandler(conflicts.postResolveConflict));

// --- Demo (destructive endpoints are token-guarded) ---
apiRouter.get('/demo/state', asyncHandler(demo.getDemoState));
apiRouter.post('/demo/reset', requireDemoToken, asyncHandler(demo.postResetDemo));
apiRouter.post('/demo/stage', requireDemoToken, asyncHandler(demo.postStageDemo));

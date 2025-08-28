import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createAgreementRequestInputSchema,
  legalReviewInputSchema,
  uploadDraftInputSchema,
  verifyDraftInputSchema,
  uploadSignedInputSchema,
  userRoleSchema
} from './schema';

// Import handlers
import { createAgreementRequest } from './handlers/create_agreement_request';
import { getAgreementRequests } from './handlers/get_agreement_requests';
import { getAgreementRequest } from './handlers/get_agreement_request';
import { legalReview } from './handlers/legal_review';
import { uploadDraftAgreement } from './handlers/upload_draft_agreement';
import { verifyDraft } from './handlers/verify_draft';
import { uploadSignedAgreement } from './handlers/upload_signed_agreement';
import { downloadSignedAgreement } from './handlers/download_signed_agreement';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Create a new agreement request (PIC Procurement)
  createAgreementRequest: publicProcedure
    .input(createAgreementRequestInputSchema)
    .mutation(({ input }) => createAgreementRequest(input)),

  // Get all agreement requests with verification status
  getAgreementRequests: publicProcedure
    .query(() => getAgreementRequests()),

  // Get a specific agreement request by ID with verification status
  getAgreementRequest: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getAgreementRequest(input.id)),

  // Legal review of agreement request (PIC Legal)
  legalReview: publicProcedure
    .input(legalReviewInputSchema)
    .mutation(({ input }) => legalReview(input)),

  // Upload draft agreement (PIC Legal)
  uploadDraftAgreement: publicProcedure
    .input(uploadDraftInputSchema)
    .mutation(({ input }) => uploadDraftAgreement(input)),

  // Verify draft agreement (PIC Procurement, PIC Tax, PIC Office Manager)
  verifyDraft: publicProcedure
    .input(verifyDraftInputSchema)
    .mutation(({ input }) => verifyDraft(input)),

  // Upload signed agreement (PIC Legal)
  uploadSignedAgreement: publicProcedure
    .input(uploadSignedInputSchema)
    .mutation(({ input }) => uploadSignedAgreement(input)),

  // Download signed agreement (PIC Procurement, PIC Tax, PIC Office Manager)
  downloadSignedAgreement: publicProcedure
    .input(z.object({ 
      agreementId: z.number(),
      userRole: userRoleSchema
    }))
    .query(({ input }) => downloadSignedAgreement(input.agreementId, input.userRole))
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();
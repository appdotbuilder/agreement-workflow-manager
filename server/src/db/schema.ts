import { serial, text, pgTable, timestamp, numeric, pgEnum, boolean, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums for user roles and statuses
export const userRoleEnum = pgEnum('user_role', ['PIC_PROCUREMENT', 'PIC_LEGAL', 'PIC_TAX', 'PIC_OFFICE_MANAGER']);
export const agreementStatusEnum = pgEnum('agreement_status', ['SUBMITTED', 'APPROVED_BY_LEGAL', 'DECLINED_BY_LEGAL', 'DRAFT_UPLOADED', 'FULLY_APPROVED', 'SIGNED_UPLOADED']);
export const verificationStatusEnum = pgEnum('verification_status', ['PENDING', 'APPROVED', 'DECLINED']);

// Agreement requests table
export const agreementRequestsTable = pgTable('agreement_requests', {
  id: serial('id').primaryKey(),
  vendor_name: text('vendor_name').notNull(),
  service_value: numeric('service_value', { precision: 15, scale: 2 }).notNull(),
  start_date: timestamp('start_date').notNull(),
  end_date: timestamp('end_date').notNull(),
  work_timeline_attachment: text('work_timeline_attachment').notNull(),
  status: agreementStatusEnum('status').notNull().default('SUBMITTED'),
  submitted_by: userRoleEnum('submitted_by').notNull(),
  submitted_at: timestamp('submitted_at').defaultNow().notNull(),
  legal_review_notes: text('legal_review_notes'),
  legal_reviewed_at: timestamp('legal_reviewed_at'),
  draft_agreement_attachment: text('draft_agreement_attachment'),
  draft_uploaded_at: timestamp('draft_uploaded_at'),
  signed_agreement_attachment: text('signed_agreement_attachment'),
  signed_uploaded_at: timestamp('signed_uploaded_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Verification records table for tracking approvals
export const verificationRecordsTable = pgTable('verification_records', {
  id: serial('id').primaryKey(),
  agreement_request_id: integer('agreement_request_id').notNull().references(() => agreementRequestsTable.id, { onDelete: 'cascade' }),
  verifier_role: userRoleEnum('verifier_role').notNull(),
  status: verificationStatusEnum('status').notNull().default('PENDING'),
  notes: text('notes'),
  verified_at: timestamp('verified_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Relations
export const agreementRequestsRelations = relations(agreementRequestsTable, ({ many }) => ({
  verifications: many(verificationRecordsTable)
}));

export const verificationRecordsRelations = relations(verificationRecordsTable, ({ one }) => ({
  agreementRequest: one(agreementRequestsTable, {
    fields: [verificationRecordsTable.agreement_request_id],
    references: [agreementRequestsTable.id]
  })
}));

// TypeScript types for the table schemas
export type AgreementRequest = typeof agreementRequestsTable.$inferSelect;
export type NewAgreementRequest = typeof agreementRequestsTable.$inferInsert;
export type VerificationRecord = typeof verificationRecordsTable.$inferSelect;
export type NewVerificationRecord = typeof verificationRecordsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  agreementRequests: agreementRequestsTable,
  verificationRecords: verificationRecordsTable
};
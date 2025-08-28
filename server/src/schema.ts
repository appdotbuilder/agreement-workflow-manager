import { z } from 'zod';

// Enum for user roles
export const userRoleSchema = z.enum(['PIC_PROCUREMENT', 'PIC_LEGAL', 'PIC_TAX', 'PIC_OFFICE_MANAGER']);
export type UserRole = z.infer<typeof userRoleSchema>;

// Enum for agreement request status
export const agreementStatusSchema = z.enum(['SUBMITTED', 'APPROVED_BY_LEGAL', 'DECLINED_BY_LEGAL', 'DRAFT_UPLOADED', 'FULLY_APPROVED', 'SIGNED_UPLOADED']);
export type AgreementStatus = z.infer<typeof agreementStatusSchema>;

// Enum for verification status
export const verificationStatusSchema = z.enum(['PENDING', 'APPROVED', 'DECLINED']);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

// Agreement request schema
export const agreementRequestSchema = z.object({
  id: z.number(),
  vendor_name: z.string(),
  service_value: z.number().positive(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  work_timeline_attachment: z.string(), // File path or URL
  status: agreementStatusSchema,
  submitted_by: userRoleSchema,
  submitted_at: z.coerce.date(),
  legal_review_notes: z.string().nullable(),
  legal_reviewed_at: z.coerce.date().nullable(),
  draft_agreement_attachment: z.string().nullable(),
  draft_uploaded_at: z.coerce.date().nullable(),
  signed_agreement_attachment: z.string().nullable(),
  signed_uploaded_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type AgreementRequest = z.infer<typeof agreementRequestSchema>;

// Verification records schema for tracking approvals
export const verificationRecordSchema = z.object({
  id: z.number(),
  agreement_request_id: z.number(),
  verifier_role: userRoleSchema,
  status: verificationStatusSchema,
  notes: z.string().nullable(),
  verified_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type VerificationRecord = z.infer<typeof verificationRecordSchema>;

// Input schema for creating agreement requests
export const createAgreementRequestInputSchema = z.object({
  vendor_name: z.string().min(1, 'Vendor name is required'),
  service_value: z.number().positive('Service value must be positive'),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  work_timeline_attachment: z.string().min(1, 'Work timeline attachment is required'),
  submitted_by: userRoleSchema
}).refine(data => data.end_date > data.start_date, {
  message: 'End date must be after start date',
  path: ['end_date']
});

export type CreateAgreementRequestInput = z.infer<typeof createAgreementRequestInputSchema>;

// Input schema for legal review
export const legalReviewInputSchema = z.object({
  agreement_request_id: z.number(),
  approved: z.boolean(),
  notes: z.string().optional()
});

export type LegalReviewInput = z.infer<typeof legalReviewInputSchema>;

// Input schema for uploading draft agreement
export const uploadDraftInputSchema = z.object({
  agreement_request_id: z.number(),
  draft_agreement_attachment: z.string().min(1, 'Draft agreement attachment is required')
});

export type UploadDraftInput = z.infer<typeof uploadDraftInputSchema>;

// Input schema for verification
export const verifyDraftInputSchema = z.object({
  agreement_request_id: z.number(),
  verifier_role: userRoleSchema,
  approved: z.boolean(),
  notes: z.string().optional()
});

export type VerifyDraftInput = z.infer<typeof verifyDraftInputSchema>;

// Input schema for uploading signed agreement
export const uploadSignedInputSchema = z.object({
  agreement_request_id: z.number(),
  signed_agreement_attachment: z.string().min(1, 'Signed agreement attachment is required')
});

export type UploadSignedInput = z.infer<typeof uploadSignedInputSchema>;

// Response schema for agreement with verification status
export const agreementWithVerificationsSchema = z.object({
  agreement: agreementRequestSchema,
  verifications: z.array(verificationRecordSchema)
});

export type AgreementWithVerifications = z.infer<typeof agreementWithVerificationsSchema>;
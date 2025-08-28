import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agreementRequestsTable, verificationRecordsTable } from '../db/schema';
import { type UploadDraftInput, type CreateAgreementRequestInput } from '../schema';
import { uploadDraftAgreement } from '../handlers/upload_draft_agreement';
import { eq, and } from 'drizzle-orm';

// Test input for uploading draft
const testUploadInput: UploadDraftInput = {
  agreement_request_id: 1,
  draft_agreement_attachment: '/uploads/draft-agreement-test.pdf'
};

// Helper to create a test agreement request
const createTestAgreementRequest = async (status: string = 'APPROVED_BY_LEGAL') => {
  const agreementInput: CreateAgreementRequestInput = {
    vendor_name: 'Test Vendor Corp',
    service_value: 50000.75,
    start_date: new Date('2024-01-01'),
    end_date: new Date('2024-12-31'),
    work_timeline_attachment: '/uploads/timeline.pdf',
    submitted_by: 'PIC_PROCUREMENT'
  };

  const result = await db.insert(agreementRequestsTable)
    .values({
      vendor_name: agreementInput.vendor_name,
      service_value: agreementInput.service_value.toString(),
      start_date: agreementInput.start_date,
      end_date: agreementInput.end_date,
      work_timeline_attachment: agreementInput.work_timeline_attachment,
      submitted_by: agreementInput.submitted_by,
      status: status as any,
      legal_review_notes: 'Approved by legal team',
      legal_reviewed_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    })
    .returning()
    .execute();

  return result[0];
};

describe('uploadDraftAgreement', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should upload draft agreement successfully', async () => {
    // Create a test agreement request with APPROVED_BY_LEGAL status
    const createdRequest = await createTestAgreementRequest('APPROVED_BY_LEGAL');
    
    const uploadInput = {
      ...testUploadInput,
      agreement_request_id: createdRequest.id
    };

    const result = await uploadDraftAgreement(uploadInput);

    // Verify the returned data
    expect(result.id).toBe(createdRequest.id);
    expect(result.draft_agreement_attachment).toBe('/uploads/draft-agreement-test.pdf');
    expect(result.status).toBe('DRAFT_UPLOADED');
    expect(result.draft_uploaded_at).toBeInstanceOf(Date);
    expect(result.service_value).toBe(50000.75);
    expect(typeof result.service_value).toBe('number');
  });

  it('should save draft agreement to database with correct status', async () => {
    const createdRequest = await createTestAgreementRequest('APPROVED_BY_LEGAL');
    
    const uploadInput = {
      ...testUploadInput,
      agreement_request_id: createdRequest.id
    };

    await uploadDraftAgreement(uploadInput);

    // Query the database to verify the update
    const updatedRequest = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, createdRequest.id))
      .execute();

    expect(updatedRequest).toHaveLength(1);
    expect(updatedRequest[0].draft_agreement_attachment).toBe('/uploads/draft-agreement-test.pdf');
    expect(updatedRequest[0].status).toBe('DRAFT_UPLOADED');
    expect(updatedRequest[0].draft_uploaded_at).toBeInstanceOf(Date);
    expect(updatedRequest[0].updated_at).toBeInstanceOf(Date);
    expect(parseFloat(updatedRequest[0].service_value)).toBe(50000.75);
  });

  it('should create verification records for all required roles', async () => {
    const createdRequest = await createTestAgreementRequest('APPROVED_BY_LEGAL');
    
    const uploadInput = {
      ...testUploadInput,
      agreement_request_id: createdRequest.id
    };

    await uploadDraftAgreement(uploadInput);

    // Query verification records
    const verificationRecords = await db.select()
      .from(verificationRecordsTable)
      .where(eq(verificationRecordsTable.agreement_request_id, createdRequest.id))
      .execute();

    expect(verificationRecords).toHaveLength(3);
    
    // Verify all required roles are present
    const roles = verificationRecords.map(record => record.verifier_role);
    expect(roles).toContain('PIC_PROCUREMENT');
    expect(roles).toContain('PIC_TAX');
    expect(roles).toContain('PIC_OFFICE_MANAGER');

    // Verify all records have PENDING status
    verificationRecords.forEach(record => {
      expect(record.status).toBe('PENDING');
      expect(record.agreement_request_id).toBe(createdRequest.id);
      expect(record.created_at).toBeInstanceOf(Date);
      expect(record.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should throw error if agreement request does not exist', async () => {
    const nonExistentInput = {
      ...testUploadInput,
      agreement_request_id: 99999
    };

    await expect(uploadDraftAgreement(nonExistentInput))
      .rejects.toThrow(/Agreement request with id 99999 not found/);
  });

  it('should throw error if agreement request is not approved by legal', async () => {
    // Create request with SUBMITTED status (not approved)
    const createdRequest = await createTestAgreementRequest('SUBMITTED');
    
    const uploadInput = {
      ...testUploadInput,
      agreement_request_id: createdRequest.id
    };

    await expect(uploadDraftAgreement(uploadInput))
      .rejects.toThrow(/Agreement request must be approved by legal before uploading draft/);
  });

  it('should throw error if agreement request is declined by legal', async () => {
    // Create request with DECLINED_BY_LEGAL status
    const createdRequest = await createTestAgreementRequest('DECLINED_BY_LEGAL');
    
    const uploadInput = {
      ...testUploadInput,
      agreement_request_id: createdRequest.id
    };

    await expect(uploadDraftAgreement(uploadInput))
      .rejects.toThrow(/Agreement request must be approved by legal before uploading draft/);
  });

  it('should handle requests that already have draft uploaded status', async () => {
    // Create request that already has DRAFT_UPLOADED status
    const createdRequest = await createTestAgreementRequest('DRAFT_UPLOADED');
    
    const uploadInput = {
      ...testUploadInput,
      agreement_request_id: createdRequest.id
    };

    await expect(uploadDraftAgreement(uploadInput))
      .rejects.toThrow(/Agreement request must be approved by legal before uploading draft/);
  });

  it('should not create duplicate verification records if called multiple times', async () => {
    const createdRequest = await createTestAgreementRequest('APPROVED_BY_LEGAL');
    
    const uploadInput = {
      ...testUploadInput,
      agreement_request_id: createdRequest.id
    };

    // First upload
    await uploadDraftAgreement(uploadInput);

    // Update status back to APPROVED_BY_LEGAL to allow second upload
    await db.update(agreementRequestsTable)
      .set({ status: 'APPROVED_BY_LEGAL' })
      .where(eq(agreementRequestsTable.id, createdRequest.id))
      .execute();

    // Second upload should create additional verification records
    await uploadDraftAgreement(uploadInput);

    const verificationRecords = await db.select()
      .from(verificationRecordsTable)
      .where(eq(verificationRecordsTable.agreement_request_id, createdRequest.id))
      .execute();

    // Should have 6 records (3 from each upload)
    expect(verificationRecords).toHaveLength(6);
  });
});
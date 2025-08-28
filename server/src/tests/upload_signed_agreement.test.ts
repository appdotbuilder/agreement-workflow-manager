import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agreementRequestsTable, verificationRecordsTable } from '../db/schema';
import { type UploadSignedInput } from '../schema';
import { uploadSignedAgreement } from '../handlers/upload_signed_agreement';
import { eq } from 'drizzle-orm';

const testInput: UploadSignedInput = {
  agreement_request_id: 1,
  signed_agreement_attachment: '/path/to/signed-agreement.pdf'
};

describe('uploadSignedAgreement', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper to create a test agreement request in FULLY_APPROVED status
  const createFullyApprovedRequest = async () => {
    const result = await db.insert(agreementRequestsTable)
      .values({
        vendor_name: 'Test Vendor',
        service_value: '50000.00',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        work_timeline_attachment: '/path/to/timeline.pdf',
        status: 'FULLY_APPROVED',
        submitted_by: 'PIC_PROCUREMENT',
        legal_review_notes: 'Approved by legal',
        legal_reviewed_at: new Date(),
        draft_agreement_attachment: '/path/to/draft.pdf',
        draft_uploaded_at: new Date()
      })
      .returning()
      .execute();

    return result[0];
  };

  it('should upload signed agreement successfully', async () => {
    // Create a test agreement request in FULLY_APPROVED status
    const testRequest = await createFullyApprovedRequest();
    
    const input = {
      ...testInput,
      agreement_request_id: testRequest.id
    };

    const result = await uploadSignedAgreement(input);

    // Verify the returned result
    expect(result.id).toBe(testRequest.id);
    expect(result.signed_agreement_attachment).toBe('/path/to/signed-agreement.pdf');
    expect(result.status).toBe('SIGNED_UPLOADED');
    expect(result.signed_uploaded_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(typeof result.service_value).toBe('number');
    expect(result.service_value).toBe(50000);

    // Verify other fields remain unchanged
    expect(result.vendor_name).toBe('Test Vendor');
    expect(result.draft_agreement_attachment).toBe('/path/to/draft.pdf');
    expect(result.legal_review_notes).toBe('Approved by legal');
  });

  it('should save signed agreement to database', async () => {
    // Create a test agreement request
    const testRequest = await createFullyApprovedRequest();
    
    const input = {
      ...testInput,
      agreement_request_id: testRequest.id
    };

    await uploadSignedAgreement(input);

    // Query the database to verify the update
    const updatedRequests = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, testRequest.id))
      .execute();

    expect(updatedRequests).toHaveLength(1);
    const updatedRequest = updatedRequests[0];
    expect(updatedRequest.signed_agreement_attachment).toBe('/path/to/signed-agreement.pdf');
    expect(updatedRequest.status).toBe('SIGNED_UPLOADED');
    expect(updatedRequest.signed_uploaded_at).toBeInstanceOf(Date);
    expect(updatedRequest.updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when agreement request does not exist', async () => {
    const input = {
      ...testInput,
      agreement_request_id: 999 // Non-existent ID
    };

    await expect(uploadSignedAgreement(input)).rejects.toThrow(/Agreement request with ID 999 not found/);
  });

  it('should throw error when agreement is not in FULLY_APPROVED status', async () => {
    // Create a test agreement request in SUBMITTED status
    const result = await db.insert(agreementRequestsTable)
      .values({
        vendor_name: 'Test Vendor',
        service_value: '25000.00',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        work_timeline_attachment: '/path/to/timeline.pdf',
        status: 'SUBMITTED', // Not FULLY_APPROVED
        submitted_by: 'PIC_PROCUREMENT'
      })
      .returning()
      .execute();

    const input = {
      ...testInput,
      agreement_request_id: result[0].id
    };

    await expect(uploadSignedAgreement(input)).rejects.toThrow(/Agreement request must be in FULLY_APPROVED status.*Current status: SUBMITTED/);
  });

  it('should throw error when agreement is in DRAFT_UPLOADED status', async () => {
    // Create a test agreement request in DRAFT_UPLOADED status
    const result = await db.insert(agreementRequestsTable)
      .values({
        vendor_name: 'Test Vendor',
        service_value: '30000.00',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        work_timeline_attachment: '/path/to/timeline.pdf',
        status: 'DRAFT_UPLOADED', // Not FULLY_APPROVED
        submitted_by: 'PIC_PROCUREMENT',
        legal_review_notes: 'Approved by legal',
        legal_reviewed_at: new Date(),
        draft_agreement_attachment: '/path/to/draft.pdf',
        draft_uploaded_at: new Date()
      })
      .returning()
      .execute();

    const input = {
      ...testInput,
      agreement_request_id: result[0].id
    };

    await expect(uploadSignedAgreement(input)).rejects.toThrow(/Agreement request must be in FULLY_APPROVED status.*Current status: DRAFT_UPLOADED/);
  });

  it('should handle numeric conversion correctly', async () => {
    // Create a test agreement request with a specific service value
    const result = await db.insert(agreementRequestsTable)
      .values({
        vendor_name: 'Numeric Test Vendor',
        service_value: '123456.78', // String representation of decimal
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        work_timeline_attachment: '/path/to/timeline.pdf',
        status: 'FULLY_APPROVED',
        submitted_by: 'PIC_PROCUREMENT',
        legal_review_notes: 'Approved by legal',
        legal_reviewed_at: new Date(),
        draft_agreement_attachment: '/path/to/draft.pdf',
        draft_uploaded_at: new Date()
      })
      .returning()
      .execute();

    const input = {
      ...testInput,
      agreement_request_id: result[0].id
    };

    const updatedResult = await uploadSignedAgreement(input);

    // Verify numeric conversion
    expect(typeof updatedResult.service_value).toBe('number');
    expect(updatedResult.service_value).toBe(123456.78);
    expect(Number.isFinite(updatedResult.service_value)).toBe(true);
  });

  it('should preserve all existing fields when uploading signed agreement', async () => {
    // Create a comprehensive test request with all fields populated
    const originalData = {
      vendor_name: 'Complete Test Vendor',
      service_value: '75000.50',
      start_date: new Date('2024-03-01'),
      end_date: new Date('2024-11-30'),
      work_timeline_attachment: '/original/timeline.pdf',
      status: 'FULLY_APPROVED' as const,
      submitted_by: 'PIC_PROCUREMENT' as const,
      legal_review_notes: 'Comprehensive legal review completed',
      legal_reviewed_at: new Date('2024-02-15'),
      draft_agreement_attachment: '/original/draft.pdf',
      draft_uploaded_at: new Date('2024-02-20')
    };

    const result = await db.insert(agreementRequestsTable)
      .values(originalData)
      .returning()
      .execute();

    const input = {
      ...testInput,
      agreement_request_id: result[0].id
    };

    const updatedResult = await uploadSignedAgreement(input);

    // Verify all original fields are preserved
    expect(updatedResult.vendor_name).toBe(originalData.vendor_name);
    expect(updatedResult.service_value).toBe(75000.5);
    expect(updatedResult.start_date).toEqual(originalData.start_date);
    expect(updatedResult.end_date).toEqual(originalData.end_date);
    expect(updatedResult.work_timeline_attachment).toBe(originalData.work_timeline_attachment);
    expect(updatedResult.submitted_by).toBe(originalData.submitted_by);
    expect(updatedResult.legal_review_notes).toBe(originalData.legal_review_notes);
    expect(updatedResult.legal_reviewed_at).toEqual(originalData.legal_reviewed_at);
    expect(updatedResult.draft_agreement_attachment).toBe(originalData.draft_agreement_attachment);
    expect(updatedResult.draft_uploaded_at).toEqual(originalData.draft_uploaded_at);

    // Verify new fields are set correctly
    expect(updatedResult.signed_agreement_attachment).toBe('/path/to/signed-agreement.pdf');
    expect(updatedResult.status).toBe('SIGNED_UPLOADED');
    expect(updatedResult.signed_uploaded_at).toBeInstanceOf(Date);
    expect(updatedResult.updated_at).toBeInstanceOf(Date);
  });
});
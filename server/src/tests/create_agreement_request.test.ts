import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agreementRequestsTable } from '../db/schema';
import { type CreateAgreementRequestInput } from '../schema';
import { createAgreementRequest } from '../handlers/create_agreement_request';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateAgreementRequestInput = {
  vendor_name: 'Test Vendor Co.',
  service_value: 25000.50,
  start_date: new Date('2024-01-01'),
  end_date: new Date('2024-12-31'),
  work_timeline_attachment: '/uploads/timeline_2024.pdf',
  submitted_by: 'PIC_PROCUREMENT'
};

describe('createAgreementRequest', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an agreement request with correct fields', async () => {
    const result = await createAgreementRequest(testInput);

    // Basic field validation
    expect(result.vendor_name).toEqual('Test Vendor Co.');
    expect(result.service_value).toEqual(25000.50);
    expect(typeof result.service_value).toBe('number'); // Verify numeric conversion
    expect(result.start_date).toEqual(testInput.start_date);
    expect(result.end_date).toEqual(testInput.end_date);
    expect(result.work_timeline_attachment).toEqual('/uploads/timeline_2024.pdf');
    expect(result.submitted_by).toEqual('PIC_PROCUREMENT');
    expect(result.status).toEqual('SUBMITTED');
    
    // Auto-generated fields
    expect(result.id).toBeDefined();
    expect(result.submitted_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Nullable fields should be null initially
    expect(result.legal_review_notes).toBeNull();
    expect(result.legal_reviewed_at).toBeNull();
    expect(result.draft_agreement_attachment).toBeNull();
    expect(result.draft_uploaded_at).toBeNull();
    expect(result.signed_agreement_attachment).toBeNull();
    expect(result.signed_uploaded_at).toBeNull();
  });

  it('should save agreement request to database', async () => {
    const result = await createAgreementRequest(testInput);

    // Query the database to verify record was saved
    const agreementRequests = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, result.id))
      .execute();

    expect(agreementRequests).toHaveLength(1);
    
    const savedRequest = agreementRequests[0];
    expect(savedRequest.vendor_name).toEqual('Test Vendor Co.');
    expect(parseFloat(savedRequest.service_value)).toEqual(25000.50); // Database stores as string
    expect(savedRequest.start_date).toEqual(testInput.start_date);
    expect(savedRequest.end_date).toEqual(testInput.end_date);
    expect(savedRequest.work_timeline_attachment).toEqual('/uploads/timeline_2024.pdf');
    expect(savedRequest.submitted_by).toEqual('PIC_PROCUREMENT');
    expect(savedRequest.status).toEqual('SUBMITTED');
    expect(savedRequest.submitted_at).toBeInstanceOf(Date);
    expect(savedRequest.created_at).toBeInstanceOf(Date);
    expect(savedRequest.updated_at).toBeInstanceOf(Date);
  });

  it('should handle different user roles correctly', async () => {
    const inputWithDifferentRole: CreateAgreementRequestInput = {
      ...testInput,
      submitted_by: 'PIC_OFFICE_MANAGER'
    };

    const result = await createAgreementRequest(inputWithDifferentRole);

    expect(result.submitted_by).toEqual('PIC_OFFICE_MANAGER');
    expect(result.status).toEqual('SUBMITTED'); // Status should still be SUBMITTED
  });

  it('should handle large service values correctly', async () => {
    const inputWithLargeValue: CreateAgreementRequestInput = {
      ...testInput,
      service_value: 9999999.99
    };

    const result = await createAgreementRequest(inputWithLargeValue);

    expect(result.service_value).toEqual(9999999.99);
    expect(typeof result.service_value).toBe('number');

    // Verify in database
    const savedRequest = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, result.id))
      .execute();

    expect(parseFloat(savedRequest[0].service_value)).toEqual(9999999.99);
  });

  it('should handle date objects correctly', async () => {
    const startDate = new Date('2025-06-15T10:30:00Z');
    const endDate = new Date('2025-12-15T18:45:00Z');
    
    const inputWithSpecificDates: CreateAgreementRequestInput = {
      ...testInput,
      start_date: startDate,
      end_date: endDate
    };

    const result = await createAgreementRequest(inputWithSpecificDates);

    expect(result.start_date).toEqual(startDate);
    expect(result.end_date).toEqual(endDate);
    
    // Verify timestamps are preserved in database
    const savedRequest = await db.select()
      .from(agreementRequestsTable)
      .where(eq(agreementRequestsTable.id, result.id))
      .execute();

    expect(savedRequest[0].start_date).toEqual(startDate);
    expect(savedRequest[0].end_date).toEqual(endDate);
  });

  it('should set timestamps automatically', async () => {
    const beforeCreation = new Date();
    
    const result = await createAgreementRequest(testInput);
    
    const afterCreation = new Date();

    // Check that timestamps are within reasonable range
    expect(result.submitted_at >= beforeCreation).toBe(true);
    expect(result.submitted_at <= afterCreation).toBe(true);
    expect(result.created_at >= beforeCreation).toBe(true);
    expect(result.created_at <= afterCreation).toBe(true);
    expect(result.updated_at >= beforeCreation).toBe(true);
    expect(result.updated_at <= afterCreation).toBe(true);
  });
});
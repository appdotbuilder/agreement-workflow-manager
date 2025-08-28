import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { agreementRequestsTable } from '../db/schema';
import { type UserRole } from '../schema';
import { downloadSignedAgreement } from '../handlers/download_signed_agreement';

// Test agreement data
const testAgreementData = {
  vendor_name: 'Test Vendor Corp',
  service_value: '50000.00',
  start_date: new Date('2024-01-01'),
  end_date: new Date('2024-12-31'),
  work_timeline_attachment: '/uploads/timeline.pdf',
  submitted_by: 'PIC_PROCUREMENT' as const,
  signed_agreement_attachment: '/uploads/signed-agreement-123.pdf',
  status: 'SIGNED_UPLOADED' as const
};

describe('downloadSignedAgreement', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should allow authorized users to download signed agreement', async () => {
    // Create test agreement with signed attachment
    const agreements = await db.insert(agreementRequestsTable)
      .values(testAgreementData)
      .returning()
      .execute();

    const agreementId = agreements[0].id;
    const authorizedRoles: UserRole[] = ['PIC_PROCUREMENT', 'PIC_TAX', 'PIC_OFFICE_MANAGER'];

    // Test each authorized role
    for (const role of authorizedRoles) {
      const result = await downloadSignedAgreement(agreementId, role);

      expect(result).toBeDefined();
      expect(result!.fileUrl).toEqual('/uploads/signed-agreement-123.pdf');
      expect(result!.fileName).toEqual(`signed-agreement-${testAgreementData.vendor_name}-${agreementId}.pdf`);
      expect(result!.contentType).toEqual('application/pdf');
    }
  });

  it('should deny unauthorized users', async () => {
    // Create test agreement
    const agreements = await db.insert(agreementRequestsTable)
      .values(testAgreementData)
      .returning()
      .execute();

    const agreementId = agreements[0].id;
    const unauthorizedRole: UserRole = 'PIC_LEGAL';

    const result = await downloadSignedAgreement(agreementId, unauthorizedRole);

    expect(result).toBeNull();
  });

  it('should return null when agreement does not exist', async () => {
    const nonExistentId = 99999;
    const authorizedRole: UserRole = 'PIC_PROCUREMENT';

    const result = await downloadSignedAgreement(nonExistentId, authorizedRole);

    expect(result).toBeNull();
  });

  it('should return null when signed agreement attachment is not available', async () => {
    // Create agreement without signed attachment
    const agreementWithoutSigned = {
      ...testAgreementData,
      signed_agreement_attachment: null,
      status: 'DRAFT_UPLOADED' as const
    };

    const agreements = await db.insert(agreementRequestsTable)
      .values(agreementWithoutSigned)
      .returning()
      .execute();

    const agreementId = agreements[0].id;
    const authorizedRole: UserRole = 'PIC_PROCUREMENT';

    const result = await downloadSignedAgreement(agreementId, authorizedRole);

    expect(result).toBeNull();
  });

  it('should return null when agreement is not in SIGNED_UPLOADED status', async () => {
    // Create agreement with signed attachment but wrong status
    const agreementWrongStatus = {
      ...testAgreementData,
      status: 'FULLY_APPROVED' as const // Not SIGNED_UPLOADED
    };

    const agreements = await db.insert(agreementRequestsTable)
      .values(agreementWrongStatus)
      .returning()
      .execute();

    const agreementId = agreements[0].id;
    const authorizedRole: UserRole = 'PIC_PROCUREMENT';

    const result = await downloadSignedAgreement(agreementId, authorizedRole);

    expect(result).toBeNull();
  });

  it('should handle various agreement statuses correctly', async () => {
    const authorizedRole: UserRole = 'PIC_PROCUREMENT';
    const statuses = ['SUBMITTED', 'APPROVED_BY_LEGAL', 'DECLINED_BY_LEGAL', 'DRAFT_UPLOADED', 'FULLY_APPROVED'] as const;

    for (const status of statuses) {
      const agreementData = {
        ...testAgreementData,
        status,
        vendor_name: `Vendor ${status}` // Make each unique
      };

      const agreements = await db.insert(agreementRequestsTable)
        .values(agreementData)
        .returning()
        .execute();

      const result = await downloadSignedAgreement(agreements[0].id, authorizedRole);

      // Should return null for all statuses except SIGNED_UPLOADED
      expect(result).toBeNull();
    }
  });

  it('should generate correct filename with vendor name', async () => {
    const vendorNames = ['Simple Corp', 'Complex & Special Inc.', 'Unicode测试公司'];

    for (const vendorName of vendorNames) {
      const agreementData = {
        ...testAgreementData,
        vendor_name: vendorName
      };

      const agreements = await db.insert(agreementRequestsTable)
        .values(agreementData)
        .returning()
        .execute();

      const agreementId = agreements[0].id;
      const result = await downloadSignedAgreement(agreementId, 'PIC_PROCUREMENT');

      expect(result).toBeDefined();
      expect(result!.fileName).toEqual(`signed-agreement-${vendorName}-${agreementId}.pdf`);
    }
  });

  it('should handle empty signed agreement attachment as null', async () => {
    // Create agreement with empty string attachment
    const agreementEmptyAttachment = {
      ...testAgreementData,
      signed_agreement_attachment: ''
    };

    const agreements = await db.insert(agreementRequestsTable)
      .values(agreementEmptyAttachment)
      .returning()
      .execute();

    const agreementId = agreements[0].id;
    const result = await downloadSignedAgreement(agreementId, 'PIC_PROCUREMENT');

    expect(result).toBeNull();
  });
});
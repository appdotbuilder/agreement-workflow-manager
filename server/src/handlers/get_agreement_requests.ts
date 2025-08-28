import { db } from '../db';
import { agreementRequestsTable, verificationRecordsTable } from '../db/schema';
import { type AgreementWithVerifications } from '../schema';
import { eq } from 'drizzle-orm';

export const getAgreementRequests = async (): Promise<AgreementWithVerifications[]> => {
  try {
    // Get all agreement requests with their verification records using a join
    const results = await db.select()
      .from(agreementRequestsTable)
      .leftJoin(verificationRecordsTable, eq(agreementRequestsTable.id, verificationRecordsTable.agreement_request_id))
      .execute();

    // Group the results by agreement request ID
    const agreementMap = new Map<number, {
      agreement: any;
      verifications: any[];
    }>();

    for (const result of results) {
      const agreementId = result.agreement_requests.id;
      
      if (!agreementMap.has(agreementId)) {
        // Convert numeric fields from strings to numbers for agreement
        const agreement = {
          ...result.agreement_requests,
          service_value: parseFloat(result.agreement_requests.service_value)
        };
        
        agreementMap.set(agreementId, {
          agreement,
          verifications: []
        });
      }

      // Add verification record if it exists
      if (result.verification_records) {
        agreementMap.get(agreementId)!.verifications.push(result.verification_records);
      }
    }

    // Convert map to array format
    return Array.from(agreementMap.values()).map(item => ({
      agreement: item.agreement,
      verifications: item.verifications
    }));
  } catch (error) {
    console.error('Failed to get agreement requests:', error);
    throw error;
  }
};
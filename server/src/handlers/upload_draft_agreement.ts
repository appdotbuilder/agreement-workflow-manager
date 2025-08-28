import { type UploadDraftInput, type AgreementRequest } from '../schema';

export const uploadDraftAgreement = async (input: UploadDraftInput): Promise<AgreementRequest> => {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to upload a draft agreement by PIC Legal after approval.
    // This should update the status to DRAFT_UPLOADED and create verification records
    // for PIC_PROCUREMENT, PIC_TAX, and PIC_OFFICE_MANAGER in the specified order.
    return Promise.resolve({
        id: input.agreement_request_id,
        vendor_name: 'Placeholder',
        service_value: 0,
        start_date: new Date(),
        end_date: new Date(),
        work_timeline_attachment: 'placeholder',
        status: 'DRAFT_UPLOADED',
        submitted_by: 'PIC_PROCUREMENT',
        submitted_at: new Date(),
        legal_review_notes: null,
        legal_reviewed_at: new Date(),
        draft_agreement_attachment: input.draft_agreement_attachment,
        draft_uploaded_at: new Date(),
        signed_agreement_attachment: null,
        signed_uploaded_at: null,
        created_at: new Date(),
        updated_at: new Date()
    } as AgreementRequest);
};
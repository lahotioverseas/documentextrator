// Reconcile LC with Contract & Draft
import { Type, ThinkingLevel } from '@google/genai';
import { callGeminiWithFallback } from '../gemini/client';
import { cleanAndParseJSON } from '../gemini/json';

export async function reconcileLC(body: any) {
  const { contractData, exportDraftData, lcDetails } = body;

  const prompt = `You are an expert trade finance auditor. Perform a rigorous discrepancy reconciliation comparing the Sales Contract, Pre-Shipment Draft, and the received Letter of Credit (MT700).

Compare all critical parameters:
1. Total Amount & Currency: verify if contract amount falls within the LC percentage tolerance.
2. Goods Description & Sales Contract Number reference in LC Field 45A vs Contract.
3. Ports: Port of Loading and Port of Discharge in LC vs Contract.
4. Parties: Applicant name/address vs Buyer; Beneficiary name/address vs Seller.
5. Dates & Shipment Validity: Latest Shipment Date in LC vs Contract validity; Expiry Date vs Presentation Period.
6. Transport Terms: Partial Shipment and Transhipment (allowed vs not allowed).
7. Tenor & Payment Mechanics: LC payment terms vs Contract payment terms.
8. Special Conditions & Document Requirements: REX number mandate, courier certificates, language rules.

Classify each discrepancy by severity:
- 'amendment_required' (Fatal mismatch: will cause bank rejection unless an MT707 amendment is issued by applicant bank).
- 'review' (Important operational variance: requires careful alignment on generated export documents).
- 'info' (Standard conforming term / benign informational note).

Return strict JSON array of discrepancy objects:
- id: unique string (e.g. 'DISC-01', 'DISC-02')
- field: target field name
- severity: 'amendment_required' | 'review' | 'info'
- title: concise heading
- contractValue: value as stated in contract/draft
- lcValue: value as stated in LC
- explanation: clear explanation of the discrepancy or conformity
- suggestedAction: actionable guidance (e.g. "Request MT707 amendment from buyer" or "Include clause verbatim in commercial invoice")

Contract Data:
${JSON.stringify(contractData, null, 2)}

Export Draft Data:
${JSON.stringify(exportDraftData, null, 2)}

Letter of Credit Data:
${JSON.stringify(lcDetails, null, 2)}`;

  const response = await callGeminiWithFallback({
    contents: prompt,
    config: {
      systemInstruction: 'Perform rigorous trade finance LC discrepancy reconciliation with accurate severity classification.',
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            field: { type: Type.STRING },
            severity: { type: Type.STRING, enum: ['amendment_required', 'review', 'info'] },
            title: { type: Type.STRING },
            contractValue: { type: Type.STRING },
            lcValue: { type: Type.STRING },
            explanation: { type: Type.STRING },
            suggestedAction: { type: Type.STRING }
          },
          required: ['id', 'field', 'severity', 'title', 'contractValue', 'lcValue', 'explanation', 'suggestedAction']
        }
      }
    }
  });

  const discrepancies = cleanAndParseJSON(response.text);

  // Sort discrepancies by severity: amendment_required (1) -> review (2) -> info (3)
  const severityOrder: Record<string, number> = {
    amendment_required: 1,
    review: 2,
    info: 3
  };

  const sortedDiscrepancies = Array.isArray(discrepancies)
    ? [...discrepancies].sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99))
    : [];

  return sortedDiscrepancies;
}

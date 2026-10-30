import { LCClause, LCAmendment } from '../types';

export interface ClauseDiffResult {
  id: string;
  field: '46A' | '47A' | '45A' | '48' | 'OTHER';
  clauseNumber: number;
  clauseMarker?: string;
  status: 'added' | 'modified' | 'removed' | 'unchanged';
  oldText?: string;
  newText?: string;
  diffSummary: string;
  impactLevel: 'critical' | 'moderate' | 'informational';
  affectedDocuments: string[];
}

export interface AmendmentDiffAudit {
  amendmentNo: string;
  amendmentDate: string;
  narrative: string;
  clauseDiffs: ClauseDiffResult[];
  headerChanges: Array<{
    field: string;
    oldValue: string;
    newValue: string;
    impact: string;
  }>;
  totalClausesBefore: number;
  totalClausesAfter: number;
  addedCount: number;
  modifiedCount: number;
  removedCount: number;
}

/**
 * Computes exact word/character-level diff highlights between two strings
 */
export function computeTextDiffChunks(oldStr: string = '', newStr: string = ''): Array<{ text: string; type: 'same' | 'added' | 'removed' }> {
  if (oldStr === newStr) {
    return [{ text: newStr, type: 'same' }];
  }

  const oldWords = oldStr.split(/(\s+)/);
  const newWords = newStr.split(/(\s+)/);
  const chunks: Array<{ text: string; type: 'same' | 'added' | 'removed' }> = [];

  // Simple word-by-word diff alignment
  let o = 0;
  let n = 0;

  while (o < oldWords.length || n < newWords.length) {
    if (o < oldWords.length && n < newWords.length && oldWords[o] === newWords[n]) {
      chunks.push({ text: newWords[n], type: 'same' });
      o++;
      n++;
    } else if (n < newWords.length && (!oldWords.slice(o).includes(newWords[n]))) {
      chunks.push({ text: newWords[n], type: 'added' });
      n++;
    } else if (o < oldWords.length && (!newWords.slice(n).includes(oldWords[o]))) {
      chunks.push({ text: oldWords[o], type: 'removed' });
      o++;
    } else {
      if (n < newWords.length) {
        chunks.push({ text: newWords[n], type: 'added' });
        n++;
      }
      if (o < oldWords.length) {
        chunks.push({ text: oldWords[o], type: 'removed' });
        o++;
      }
    }
  }

  return chunks;
}

/**
 * Diffs an incoming set of clauses against the existing clause list.
 * Highlights exactly what was added, modified, or preserved.
 */
export function diffClauses(
  existingClauses: LCClause[],
  amendmentData: LCAmendment,
  newPatchedClauses: LCClause[] = []
): AmendmentDiffAudit {
  const clauseDiffs: ClauseDiffResult[] = [];
  const existingMap = new Map<string, LCClause>();

  existingClauses.forEach(c => {
    existingMap.set(c.id, c);
  });

  const processedIds = new Set<string>();

  // Check patched/new clauses
  for (const newClause of newPatchedClauses) {
    processedIds.add(newClause.id);
    const existing = existingMap.get(newClause.id);

    if (!existing) {
      // Brand new clause added in amendment
      clauseDiffs.push({
        id: newClause.id,
        field: newClause.field,
        clauseNumber: newClause.clauseNumber,
        clauseMarker: newClause.clauseMarker,
        status: 'added',
        newText: newClause.verbatimText,
        diffSummary: `New clause ${newClause.id} added by Amendment #${amendmentData.amendmentNo}`,
        impactLevel: 'critical',
        affectedDocuments: (newClause.appliesToDocument || newClause.affectedDocuments || []) as string[]
      });
    } else if (existing.verbatimText.trim() !== newClause.verbatimText.trim()) {
      // Existing clause modified
      clauseDiffs.push({
        id: newClause.id,
        field: newClause.field,
        clauseNumber: newClause.clauseNumber,
        clauseMarker: newClause.clauseMarker,
        status: 'modified',
        oldText: existing.verbatimText,
        newText: newClause.verbatimText,
        diffSummary: `Modified by Amendment #${amendmentData.amendmentNo}: terms updated`,
        impactLevel: 'critical',
        affectedDocuments: (newClause.appliesToDocument || newClause.affectedDocuments || []) as string[]
      });
    } else {
      // Unchanged
      clauseDiffs.push({
        id: newClause.id,
        field: newClause.field,
        clauseNumber: newClause.clauseNumber,
        clauseMarker: newClause.clauseMarker,
        status: 'unchanged',
        newText: newClause.verbatimText,
        diffSummary: 'Clause terms confirmed unchanged',
        impactLevel: 'informational',
        affectedDocuments: (newClause.appliesToDocument || newClause.affectedDocuments || []) as string[]
      });
    }
  }

  // Check for any clauses mentioned in amendment narrative/changes that may not be in patchedClauses
  amendmentData.changes.forEach(ch => {
    if (ch.field.toLowerCase().includes('46a') || ch.field.toLowerCase().includes('47a') || ch.field.toLowerCase().includes('clause')) {
      const fieldIdMatch = ch.field.match(/(46A|47A)\s*[\.\#]?\s*(\d+)/i);
      const targetId = fieldIdMatch ? `${fieldIdMatch[1].toUpperCase()}.${fieldIdMatch[2]}` : ch.field;

      if (!processedIds.has(targetId)) {
        processedIds.add(targetId);
        const existing = existingMap.get(targetId);
        clauseDiffs.push({
          id: targetId,
          field: (targetId.startsWith('46A') ? '46A' : targetId.startsWith('47A') ? '47A' : 'OTHER') as any,
          clauseNumber: fieldIdMatch ? parseInt(fieldIdMatch[2], 10) : 0,
          status: existing ? 'modified' : 'added',
          oldText: ch.oldValue,
          newText: ch.newValue,
          diffSummary: `${ch.impact || 'Clause amended'}`,
          impactLevel: 'critical',
          affectedDocuments: ['invoice', 'packing_list']
        });
      }
    }
  });

  const addedCount = clauseDiffs.filter(d => d.status === 'added').length;
  const modifiedCount = clauseDiffs.filter(d => d.status === 'modified').length;
  const removedCount = clauseDiffs.filter(d => d.status === 'removed').length;

  return {
    amendmentNo: amendmentData.amendmentNo,
    amendmentDate: amendmentData.amendmentDate,
    narrative: amendmentData.narrative,
    clauseDiffs,
    headerChanges: amendmentData.changes,
    totalClausesBefore: existingClauses.length,
    totalClausesAfter: existingClauses.length + addedCount - removedCount,
    addedCount,
    modifiedCount,
    removedCount
  };
}

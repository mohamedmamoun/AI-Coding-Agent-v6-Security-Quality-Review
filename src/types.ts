export type Severity = 'critical' | 'warning' | 'minor';
export type Category = 'security' | 'correctness' | 'performance' | 'style';

export interface Finding {
    id: string;
    category: Category;
    severity: Severity;
    startLine: number;
    endLine: number;
    explanation: string;
}

export interface Edit {
    startLine: number;
    endLine: number;
    replacementCode: string;
}

export interface FixProposal {
    rationale: string;
    edits: Edit[];
}

export interface VerificationResult {
    resolved: boolean;
    reason: string;
}

export type FixStatus = 'open' | 'verifying' | 'resolved' | 'skipped';

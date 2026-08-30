import { Finding, FixProposal, VerificationResult } from "./types";

export async function reviewCode(code: string): Promise<Finding[]> {
    const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.findings || [];
}

export async function proposeFix(code: string, finding: Finding): Promise<FixProposal> {
    const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, finding })
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

export async function verifyFix(code: string, finding: Finding): Promise<VerificationResult> {
    const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, finding })
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

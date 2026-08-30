import React, { useState, useMemo } from 'react';
import { Finding, FixProposal, FixStatus, VerificationResult } from './types';
import { reviewCode, verifyFix } from './api';
import { CodePanel } from './components/CodePanel';
import { FindingsList } from './components/FindingsList';

const INITIAL_CODE = `function processUserData(userId, db) {
    // Authenticate with DB
    const apiKey = "sk_live_9a8b7c6d5e4f3a2b1c0";
    db.authenticate(apiKey);

    // Fetch user items
    const query = "SELECT * FROM users WHERE id = " + userId;
    const result = db.execute(query);

    // Process all items
    let i = 0;
    const processed = [];
    while (i < result.items.length) {
        processed.push(transform(result.items[i]));
        // Error: missing increment leads to unbounded loop
    }

    return processed;
}`;

export default function App() {
    const [code, setCode] = useState(INITIAL_CODE);
    const [isReviewing, setIsReviewing] = useState(false);
    const [findings, setFindings] = useState<Finding[]>([]);
    const [fixProposals, setFixProposals] = useState<Record<string, FixProposal>>({});
    const [fixStatuses, setFixStatuses] = useState<Record<string, FixStatus>>({});
    const [verificationResults, setVerificationResults] = useState<Record<string, VerificationResult>>({});

    const handleReview = async () => {
        setIsReviewing(true);
        try {
            const newFindings = await reviewCode(code);
            setFindings(newFindings);
            setFixProposals({});
            setFixStatuses({});
            setVerificationResults({});
        } catch (e: any) {
            console.error(e);
            alert("Review failed. Ensure your Gemini API Key is configured. " + e.message);
        } finally {
            setIsReviewing(false);
        }
    };

    const handleProposalReceived = (findingId: string, proposal: FixProposal) => {
        setFixProposals(prev => ({ ...prev, [findingId]: proposal }));
    };

    const handleSkipFix = (findingId: string) => {
        setFixStatuses(prev => ({ ...prev, [findingId]: 'skipped' }));
    };

    const handleApproveFix = async (findingId: string) => {
        const proposal = fixProposals[findingId];
        if (!proposal) return;

        let codeLines = code.split('\n');
        // Sort edits bottom-up to prevent line shifts during single application
        const sortedEdits = [...proposal.edits].sort((a, b) => b.startLine - a.startLine);

        let newFindings = [...findings];

        for (const edit of sortedEdits) {
            const replaceLines = edit.replacementCode.split('\n');
            const removeCount = edit.endLine - edit.startLine + 1;
            codeLines.splice(edit.startLine - 1, removeCount, ...replaceLines);

            const delta = replaceLines.length - removeCount;
            // Shift subsequent findings
            newFindings = newFindings.map(f => {
                if (f.id === findingId) return f;
                if (f.startLine > edit.endLine) {
                    return { ...f, startLine: f.startLine + delta, endLine: f.endLine + delta };
                }
                return f;
            });
        }

        const newCode = codeLines.join('\n');
        setCode(newCode);
        setFindings(newFindings);
        setFixStatuses(prev => ({ ...prev, [findingId]: 'verifying' }));

        try {
            const result = await verifyFix(newCode, findings.find(f => f.id === findingId)!);
            setVerificationResults(prev => ({ ...prev, [findingId]: result }));
            setFixStatuses(prev => ({ ...prev, [findingId]: 'resolved' }));
        } catch (e) {
            console.error(e);
            setFixStatuses(prev => ({ ...prev, [findingId]: 'open' }));
            alert("Verification check failed.");
        }
    };

    // Compute stats
    const stats = useMemo(() => {
        let total = findings.length;
        let critical = 0;
        let warning = 0;
        let resolved = 0;
        let open = 0;

        findings.forEach(f => {
            const status = fixStatuses[f.id] || 'open';
            if (status !== 'skipped') {
                if (status === 'resolved') resolved++;
                else open++;
                
                if (f.severity === 'critical') critical++;
                if (f.severity === 'warning') warning++;
            }
        });

        return { total: open + resolved, critical, warning, resolved, open };
    }, [findings, fixStatuses]);

    return (
        <div className="flex flex-col h-screen w-full bg-[#0D0E12] text-[#E0E2E5] font-sans select-none overflow-hidden">
            {/* Header */}
            <header className="h-14 border-b border-[#2A2D35] bg-[#16181D] flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shadow-lg">v6</div>
                    <h1 className="text-sm font-semibold tracking-wider uppercase text-gray-400">AI Coding Agent <span className="text-white">— Security & Quality Review</span></h1>
                </div>
                
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-gray-500 font-bold">Total Findings</span>
                            <span className="text-lg font-mono leading-none">{stats.total.toString().padStart(2, '0')}</span>
                        </div>
                        <div className="h-8 w-px bg-[#2A2D35]"></div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-gray-500 font-bold">Resolved</span>
                            <span className="text-lg font-mono text-green-400 leading-none">{stats.resolved.toString().padStart(2, '0')}</span>
                        </div>
                        <div className="h-8 w-px bg-[#2A2D35]"></div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-gray-500 font-bold text-red-500">Open Risks</span>
                            <span className="text-lg font-mono text-red-500 leading-none">{stats.open.toString().padStart(2, '0')}</span>
                        </div>
                    </div>
                    
                    <button
                        onClick={handleReview}
                        disabled={isReviewing}
                        className="bg-[#2A2D35] hover:bg-[#363A45] text-white text-xs font-bold px-4 py-2 rounded border border-[#3E424D] disabled:opacity-50 transition-colors uppercase"
                    >
                        {isReviewing ? 'Analyzing...' : 'Re-run Scan'}
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex overflow-hidden">
                {/* Left: Code Panel */}
                <section className="w-3/5 border-r border-[#2A2D35] flex flex-col bg-[#0D0E12] relative">
                    <CodePanel 
                        code={code} 
                        findings={findings} 
                        fixStatuses={fixStatuses} 
                    />
                </section>

                {/* Right: Findings Triage */}
                <section className="w-2/5 flex flex-col bg-[#111318]">
                    <FindingsList 
                        code={code}
                        findings={findings}
                        fixProposals={fixProposals}
                        fixStatuses={fixStatuses}
                        verificationResults={verificationResults}
                        onProposalReceived={handleProposalReceived}
                        onApproveFix={handleApproveFix}
                        onSkipFix={handleSkipFix}
                    />
                </section>
            </main>
        </div>
    );
}

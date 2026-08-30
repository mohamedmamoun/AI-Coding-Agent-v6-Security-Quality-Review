import React, { useState } from 'react';
import { Finding, FixProposal, FixStatus, VerificationResult } from '../types';
import { CheckCircle } from 'lucide-react';
import { proposeFix } from '../api';

interface FindingsListProps {
    code: string;
    findings: Finding[];
    fixProposals: Record<string, FixProposal>;
    fixStatuses: Record<string, FixStatus>;
    verificationResults: Record<string, VerificationResult>;
    onProposalReceived: (findingId: string, proposal: FixProposal) => void;
    onApproveFix: (findingId: string) => void;
    onSkipFix: (findingId: string) => void;
}

export const FindingsList: React.FC<FindingsListProps> = ({
    code, findings, fixProposals, fixStatuses, verificationResults,
    onProposalReceived, onApproveFix, onSkipFix
}) => {
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

    const handlePropose = async (finding: Finding) => {
        setLoadingMap(prev => ({ ...prev, [finding.id]: true }));
        try {
            const proposal = await proposeFix(code, finding);
            onProposalReceived(finding.id, proposal);
        } catch (err) {
            console.error(err);
            alert("Failed to generate fix.");
        } finally {
            setLoadingMap(prev => ({ ...prev, [finding.id]: false }));
        }
    };

    const getCardStyle = (severity: string, status: string) => {
        if (status === 'resolved') {
            return 'bg-[#16181D] border-green-500/50';
        }
        if (severity === 'critical') return 'bg-[#1C1F26] border-red-500/50';
        if (severity === 'warning') return 'bg-[#1C1F26] border-amber-500/50';
        return 'bg-[#1C1F26] border-[#2A2D35] opacity-70';
    };

    const getBadgeStyle = (severity: string) => {
        if (severity === 'critical') return 'bg-red-500 text-white';
        if (severity === 'warning') return 'bg-amber-500 text-white';
        return 'bg-gray-600 text-white';
    };

    const sortedFindings = [...findings].sort((a, b) => {
        const order = { critical: 0, warning: 1, minor: 2 };
        return order[a.severity] - order[b.severity];
    });

    return (
        <>
            <div className="h-8 bg-[#16181D] border-b border-[#2A2D35] flex items-center px-4 shrink-0">
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Triage Panel</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {findings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                        <CheckCircle className="w-12 h-12 text-gray-600" />
                        <p>Run review to see findings</p>
                    </div>
                ) : (
                    sortedFindings.map(finding => {
                        const status = fixStatuses[finding.id] || 'open';
                        const proposal = fixProposals[finding.id];
                        const verification = verificationResults[finding.id];
                        const isLoading = loadingMap[finding.id];
                        
                        if (status === 'skipped') return null;

                        if (status === 'resolved' && verification) {
                            return (
                                <div key={finding.id} className="bg-[#16181D] border border-green-500/50 rounded overflow-hidden">
                                    <div className="p-4 border-b border-[#2A2D35] bg-green-500/5">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex gap-2">
                                                <span className="px-1.5 py-0.5 bg-green-600 text-white text-[9px] font-bold uppercase rounded">Resolved</span>
                                                <span className="px-1.5 py-0.5 bg-[#2A2D35] text-gray-400 text-[9px] font-bold uppercase rounded">{finding.category}</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-green-500 uppercase">Verified ✓</span>
                                        </div>
                                        <p className="text-xs text-gray-400 italic mb-3">"{verification.reason}"</p>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={finding.id} className={`border rounded p-4 relative ${getCardStyle(finding.severity, status)}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex gap-2">
                                        <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${getBadgeStyle(finding.severity)}`}>
                                            {finding.severity}
                                        </span>
                                        <span className="px-1.5 py-0.5 bg-[#2A2D35] text-gray-400 text-[9px] font-bold uppercase rounded">
                                            {finding.category}
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-mono text-gray-500">
                                        Line {finding.startLine}{finding.endLine > finding.startLine ? `-${finding.endLine}` : ''}
                                    </span>
                                </div>
                                
                                <p className="text-sm text-gray-200 mb-3">
                                    {finding.explanation}
                                </p>

                                {status === 'verifying' && (
                                    <div className="text-sm text-gray-400 flex items-center animate-pulse mb-3">
                                        Verifying fix...
                                    </div>
                                )}

                                {status === 'open' && !proposal && (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handlePropose(finding)}
                                            disabled={isLoading}
                                            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded uppercase disabled:opacity-50 transition-colors"
                                        >
                                            {isLoading ? 'Analyzing...' : 'Propose Fix'}
                                        </button>
                                        <button 
                                            onClick={() => onSkipFix(finding.id)}
                                            className="border border-[#3E424D] text-gray-400 hover:text-gray-200 text-[10px] font-bold px-3 py-1.5 rounded uppercase transition-colors"
                                        >
                                            Skip
                                        </button>
                                    </div>
                                )}

                                {status === 'open' && proposal && (
                                    <div className="mt-2 space-y-3">
                                        <p className="text-xs text-gray-400 italic mb-3">"{proposal.rationale}"</p>
                                        
                                        <div className="space-y-2">
                                            {proposal.edits.map((edit, idx) => {
                                                const originalLines = code.split('\n').slice(edit.startLine - 1, edit.endLine);
                                                return (
                                                    <div key={idx} className="font-mono text-[11px] bg-black/40 p-2 rounded overflow-x-auto">
                                                        {originalLines.length > 0 && (
                                                            <div className="text-red-400/80">
                                                                {originalLines.map((l, i) => (
                                                                    <div key={i} className="whitespace-pre"><span className="line-through">- {l}</span></div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <div className="text-green-400 mt-1">
                                                            {edit.replacementCode.split('\n').map((l, i) => (
                                                                <div key={i} className="whitespace-pre">+ {l}</div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        
                                        <div className="flex gap-2 pt-2">
                                            <button 
                                                onClick={() => onApproveFix(finding.id)}
                                                className="bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold px-3 py-1.5 rounded uppercase transition-colors"
                                            >
                                                Approve
                                            </button>
                                            <button 
                                                onClick={() => onSkipFix(finding.id)}
                                                className="border border-[#3E424D] text-gray-400 hover:text-gray-200 text-[10px] font-bold px-3 py-1.5 rounded uppercase transition-colors"
                                            >
                                                Skip
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
            
            <footer className="h-12 border-t border-[#2A2D35] bg-[#16181D] flex items-center px-4 justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">Review Pass Active</span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono italic">Model: gemini-3.6-flash</span>
            </footer>
        </>
    );
};

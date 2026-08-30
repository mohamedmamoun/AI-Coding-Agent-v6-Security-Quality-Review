import React from 'react';
import { Finding, FixStatus } from '../types';

interface CodePanelProps {
    code: string;
    findings: Finding[];
    fixStatuses: Record<string, FixStatus>;
}

const SEVERITY_COLORS = {
    critical: { bg: 'bg-red-900/20 border-l-2 border-red-500', num: 'text-red-500 bg-red-500/10' },
    warning: { bg: 'bg-amber-900/20 border-l-2 border-amber-500', num: 'text-amber-500 bg-amber-500/10' },
    minor: { bg: 'bg-gray-700/20 border-l-2 border-gray-400', num: 'text-gray-400 bg-gray-400/10' }
};

export const CodePanel: React.FC<CodePanelProps> = ({ code, findings, fixStatuses }) => {
    const lines = code.split('\n');
    
    // Map lines to active findings (not resolved/skipped)
    const activeFindings = findings.filter(f => {
        const status = fixStatuses[f.id] || 'open';
        return status !== 'resolved' && status !== 'skipped';
    });

    const getLineStyles = (lineNumber: number) => {
        const lineFindings = activeFindings.filter(f => lineNumber >= f.startLine && lineNumber <= f.endLine);
        if (lineFindings.length === 0) return null;
        
        // Find highest severity
        if (lineFindings.some(f => f.severity === 'critical')) return SEVERITY_COLORS.critical;
        if (lineFindings.some(f => f.severity === 'warning')) return SEVERITY_COLORS.warning;
        return SEVERITY_COLORS.minor;
    };

    return (
        <>
            <div className="h-8 bg-[#16181D] border-b border-[#2A2D35] flex items-center px-4 justify-between shrink-0">
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Reviewing: src/App.ts</span>
                <span className="text-[10px] font-mono text-blue-500">UTF-8 | JavaScript</span>
            </div>
            <div className="flex-1 font-mono text-[13px] leading-6 overflow-y-auto bg-[#0D0E12]">
                <div className="flex pt-4">
                    <div className="w-12 bg-[#16181D] border-r border-[#2A2D35] flex flex-col items-center text-gray-600 select-none shrink-0 pb-4">
                        {lines.map((_, idx) => {
                            const lineNumber = idx + 1;
                            const styles = getLineStyles(lineNumber);
                            return (
                                <span key={lineNumber} className={styles ? `${styles.num} w-full text-center block` : 'block'}>
                                    {lineNumber}
                                </span>
                            );
                        })}
                    </div>
                    <div className="flex-1 px-4 relative pb-4 overflow-x-auto">
                        {lines.map((line, idx) => {
                            const lineNumber = idx + 1;
                            const styles = getLineStyles(lineNumber);
                            
                            return (
                                <div key={lineNumber} className={`whitespace-pre pl-1 min-h-[24px] ${styles ? styles.bg : ''}`}>
                                    {line || ' '}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
};

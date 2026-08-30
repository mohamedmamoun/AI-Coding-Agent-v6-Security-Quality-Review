import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const extractJson = (text: string) => {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    return JSON.parse(match ? match[1] : text);
};

async function fetchGemini(systemInstruction: string, userMessage: string, retries = 3): Promise<any> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is missing. Please configure it in the Secrets panel.");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-3.6-flash",
                contents: userMessage,
                config: {
                    systemInstruction,
                    responseMimeType: "application/json",
                }
            });

            return JSON.parse(response.text!);
        } catch (error: any) {
            const isRetryable = error?.status === 429 || error?.status === 503 || error?.message?.includes('429') || error?.message?.includes('503') || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('UNAVAILABLE');
            if (isRetryable && attempt < retries - 1) {
                // Wait for a few seconds before retrying to respect the rate limit or server overload backoff
                const delay = 5000 * Math.pow(2, attempt);
                console.warn(`API Error (${error?.status || 'Retryable'}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
}

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    app.post("/api/review", async (req, res) => {
        try {
            const { code } = req.body;
            const system = "You are a senior security and quality engineer. Review the provided code snippet. Identify any security vulnerabilities, correctness bugs, performance issues, or style violations. Return ONLY a JSON object with a 'findings' array. Each finding MUST have: 'id' (unique string), 'category' ('security' | 'correctness' | 'performance' | 'style'), 'severity' ('critical' | 'warning' | 'minor'), 'startLine' (number, 1-indexed), 'endLine' (number, 1-indexed), 'explanation' (1 sentence explaining actual risk). No markdown outside the JSON block.";
            const msg = `Code to review:\n\n${code}`;
            const data = await fetchGemini(system, msg);
            res.json(data);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post("/api/fix", async (req, res) => {
        try {
            const { code, finding } = req.body;
            const system = "You are a senior security and quality engineer. I have a code snippet and a finding. Generate a fix for this specific finding. Return ONLY a JSON object containing: 'rationale' (short string), 'edits' (array of objects with 'startLine', 'endLine', and 'replacementCode'). startLine and endLine are 1-indexed and inclusive. replacementCode is the exact code to replace those lines. No markdown outside the JSON block.";
            const msg = `Code:\n${code}\n\nFinding to fix:\n${JSON.stringify(finding)}`;
            const data = await fetchGemini(system, msg);
            res.json(data);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post("/api/verify", async (req, res) => {
        try {
            const { code, finding } = req.body;
            const system = "You are a senior security and quality engineer. A fix was just applied to resolve a finding. Review the new code to verify if the specific issue is gone and no new obvious issues were introduced. Return ONLY a JSON object with: 'resolved' (boolean), 'reason' (1 sentence explanation). No markdown outside the JSON block.";
            const msg = `New Code:\n${code}\n\nFinding that was supposed to be fixed:\n${JSON.stringify(finding)}`;
            const data = await fetchGemini(system, msg);
            res.json(data);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();

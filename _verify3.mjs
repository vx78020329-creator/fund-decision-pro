import { readFileSync } from 'fs';
const c = readFileSync('C:/Users/86178/Documents/New project/fund-decision/server/src/services/ai-agents.ts', 'utf8');
// Find system prompt and show exact bytes
const idx = c.indexOf('system');
const chunk = c.substring(idx, idx + 120);
// Check if it contains literal \\u sequences
const hasEscapes = chunk.includes('\\\\u');
console.log('Has literal escapes:', hasEscapes);
console.log('First 100 chars of chunk:', JSON.stringify(chunk.substring(0, 100)));
// The issue is the file stores \u4f60 as actual unicode char, not as literal \\u
// Let me check the char codes
const sysContent = c.substring(c.indexOf('system', idx) + 20, c.indexOf('system', idx) + 40);
console.log('Content chars:', [...sysContent].map(c => c.charCodeAt(0).toString(16)).join(' '));

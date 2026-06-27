import { readFileSync } from 'fs';
const c = readFileSync('C:/Users/86178/Documents/New project/fund-decision/server/src/services/ai-agents.ts', 'utf8');
const idx = c.indexOf('system');
const area = c.substring(idx, idx + 250);
console.log('System prompt:', area);
// Check if it has CFA or 10年经验
if (area.includes('\\u62e5\\u670910\\u5e74')) console.log('Has 10 years experience - GOOD');
if (area.includes('\\u57fa\\u91d1\\u5206\\u6790\\u5f15\\u64ce')) console.log('Still old prompt - needs fix');

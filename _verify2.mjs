import { readFileSync, writeFileSync } from 'fs';
const path = 'C:/Users/86178/Documents/New project/fund-decision/server/src/services/ai-agents.ts';
let c = readFileSync(path, 'utf8');

// Direct fix: replace the system content string
const oldPrompt = '\u4f60\u662f\u57fa\u91d1\u5206\u6790\u5f15\u64ce\u3002\u5f53\u524d\u65f6\u95f4:';
const newPrompt = '\u4f60\u662f\u62e5\u670910\u5e74\u7ecf\u9a8c\u7684\u8d44\u6df1\u57fa\u91d1\u5206\u6790\u5e08\u3002\u7528\u4e13\u4e1a\u91d1\u878d\u77e5\u8bc6\u5206\u6790\u3002\u5f53\u524d\u65f6\u95f4:';

console.log('Old prompt found:', c.includes(oldPrompt));
console.log('New prompt already there:', c.includes(newPrompt));

if (c.includes(oldPrompt) && !c.includes(newPrompt)) {
  c = c.replace(oldPrompt, newPrompt);
  writeFileSync(path, c, 'utf8');
  console.log('Fixed system prompt');
} else if (c.includes(newPrompt)) {
  console.log('Already improved');
} else {
  console.log('Neither found');
}

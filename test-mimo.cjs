const OpenAI = require("openai");
const fs = require("fs");

const settings = JSON.parse(fs.readFileSync("server/data/settings.json", "utf-8"));
let url = settings.AI_BASE_URL || "https://token-plan-cn.xiaomimimo.com/v1";
if (!url.endsWith("/v1")) url += "/v1";

const client = new OpenAI({ baseURL: url, apiKey: settings.AI_API_KEY || "" });

async function test() {
  try {
    const r = await client.chat.completions.create({
      model: settings.AI_MODEL || "mimo-v2.5-pro",
      messages: [
        { role: "system", content: "\u4f60\u662f\u91d1\u878d\u5206\u6790\u5e08\u3002\u53ea\u8f93\u51faJSON\uff0c\u65e0\u5176\u4ed6\u6587\u5b57\u3002" },
        { role: "user", content: "\u5206\u6790\u65b0\u95fb\u5bf9A\u80a1\u5f71\u54cd\u3002\u65b0\u95fb\uff1a\u7f8e\u5149\u79d1\u6280\u76d8\u521d\u6da8\u5e45\u6269\u5927\u81f3\u8d8519%\n\u8fd4\u56deJSON\uff1a{\"s\":\"\u6458\u8981\",\"i\":\"\u5f71\u54cd\",\"r\":\"\u5efa\u8bae\",\"sc\":0,\"d\":\"neutral\"}" }
      ],
      temperature: 0.1,
      max_tokens: 300,
    });
    
    const msg = r.choices[0]?.message;
    console.log("=== content ===");
    console.log(msg?.content || "(empty)");
    console.log("\n=== reasoning_content (last 500) ===");
    const rc = msg?.reasoning_content || "";
    console.log(rc.slice(-500));
    console.log("\n=== finish_reason ===");
    console.log(r.choices[0]?.finish_reason);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

test();
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const wf = read('../workflows/GreenSteps_Web2_Gemini_Agent_V3_Performance.json');
const backup = read('../workflows/GreenSteps_Web2_Gemini_Agent_V2.json');
const find = name => wf.nodes.find(n => n.name === name);
assert.equal(backup.nodes.find(n => n.name === 'AI Agent').parameters.options.maxIterations, 8);
assert.equal(backup.nodes.find(n => n.name === 'Webhook Chat').parameters.path, 'greensteps-web2-agent-v2');
assert.equal(find('Webhook Chat').parameters.path, 'greensteps-web2-agent-v3-fast');
assert.equal(find('AI Agent').parameters.options.maxIterations, 3);
assert.equal(find('Google Gemini Chat Model').parameters.options.maxOutputTokens, 4096);
assert.equal(wf.settings.executionTimeout, 30);
assert.equal(wf.active, false);
for (const node of wf.nodes) {
  assert.equal(node.retryOnFail, false);
  if (node.parameters.jsCode) new vm.Script(`(function(){${node.parameters.jsCode}\n})`);
}
const names = new Set(wf.nodes.map(n => n.name));
assert.equal(names.size, wf.nodes.length);
for (const [from, ports] of Object.entries(wf.connections)) {
  assert(names.has(from));
  for (const paths of Object.values(ports)) for (const edges of paths) for (const edge of edges) assert(names.has(edge.node));
}
const payload = read('sample-n8n-payload.json');
const validated = vm.runInNewContext(`(()=>{${find('Validate Input').parameters.jsCode}})()`, { $input: { first: () => ({ json: { body: payload } }) } })[0].json;
assert.equal(validated.valid, true);
const logs = [];
const data = { $: name => ({ first: () => ({ json: name === 'AI Start' ? { _aiStartedAt: Date.now() - 5 } : validated }) }), console: { log: line => logs.push(JSON.parse(line)) } };
const result = vm.runInNewContext(`(()=>{${find('search_tours').parameters.jsCode}})()`, { ...data, query: { search: 'Đà Lạt', maxBudget: 3000000, days: 3 } });
assert.equal(JSON.parse(result).matches[0].id, 'demo-tour-01');
assert.equal(logs[0].tool, 'search_tours');
assert.equal(logs[0].durationMs >= 0, true);
const reply = vm.runInNewContext(`(()=>{${find('Format Reply').parameters.jsCode}})()`, { ...data, $input: { first: () => ({ json: { output: 'Valid AI answer' } }) } })[0].json;
assert.equal(reply.success, true);
assert.equal(reply.output, 'Valid AI answer');
assert.equal(reply.performance.agentMs >= 0, true);
const empty = vm.runInNewContext(`(()=>{${find('Format Reply').parameters.jsCode}})()`, { ...data, $input: { first: () => ({ json: {} }) } })[0].json;
assert.equal(empty.success, false);
assert.equal(empty.output, '');
const long = 'a'.repeat(13000);
const longReply = vm.runInNewContext(`(()=>{${find('Format Reply').parameters.jsCode}})()`, { ...data, $input: { first: () => ({ json: { output: long } }) } })[0].json;
assert.equal(longReply.output.length, 13000); // no silent character slicing
const limited = vm.runInNewContext(`(()=>{${find('Format Reply').parameters.jsCode}})()`, { ...data, $input: { first: () => ({ json: { output: 'Partial', finishReason: 'MAX_TOKENS' } }) } })[0].json;
assert.equal(limited.outputLimited, true);
assert.match(limited.output, /giới hạn độ dài/);
const stopped = vm.runInNewContext(`(()=>{${find('Format Reply').parameters.jsCode}})()`, { ...data, $input: { first: () => ({ json: { output: 'Agent stopped due to max iterations.' } }) } })[0].json;
assert.equal(stopped.success, false);
assert.equal(stopped.code, 'CHAT_ITERATION_LIMIT');
assert.equal(stopped.output, '');
console.log('PASS: V2 retained; V3 graph, code, tools, metrics and failure contract. Static/simulated, not a live V3 execution.');

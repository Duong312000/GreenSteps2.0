// Static and simulated checks; DOES NOT execute the actual n8n server.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const wf=JSON.parse(fs.readFileSync(__dirname+'/../workflows/GreenSteps_Web2_Gemini_Agent_V2.json'));
const names=new Set(wf.nodes.map(n=>n.name));
assert.equal(names.size,wf.nodes.length);
for(const [from,ports] of Object.entries(wf.connections)) {
 assert(names.has(from),`source ${from}`);
 for(const list of Object.values(ports)) for(const path of list) for(const edge of path) assert(names.has(edge.node),`target ${edge.node}`);
}
const find=n=>wf.nodes.find(x=>x.name===n);
assert.equal(find('Webhook Chat').parameters.path,'greensteps-web2-agent-v2');
assert.equal(find('Webhook Chat').parameters.authentication,'headerAuth');
assert(find('Format Reply').parameters.jsCode.includes('output'));
assert(wf.active===false);
const payload=JSON.parse(fs.readFileSync(__dirname+'/sample-n8n-payload.json'));
const codeContext={ $input:{first:()=>({json:{body:payload}})} };
const check=vm.runInNewContext(`(function(){${find('Validate Input').parameters.jsCode}})()`,codeContext)[0].json;
assert(check.valid);
assert(check.catalog.available);
assert.equal(check.catalog.services.length,1); // pending hidden
assert.equal(check.catalog.tours.length,2);
const executedTool=(name,input)=>vm.runInNewContext(`(function(){${find(name).parameters.jsCode}})()`,{
 query:input,$:(s)=>({first:()=>({json:check})})
});
const matchedTours=JSON.parse(executedTool('search_tours',{search:'Đà Lạt',maxBudget:3000000,days:3}));
assert.equal(matchedTours.matches.length,1);
assert.equal(matchedTours.matches[0].id,'demo-tour-01');
const matchedServices=JSON.parse(executedTool('search_services',{destination:'Đà Lạt'}));
assert.equal(matchedServices.matches.length,1);
const budget=JSON.parse(executedTool('budget_estimate',{items:[{name:'Vé tour',unitCost:1000000,quantity:2},{name:'Ăn',unitCost:120000,quantity:3}],budget:3000000}));
assert.equal(budget.total,2360000);
const dest=JSON.parse(executedTool('destination_inventory',{}));
assert.equal(dest.destinations.length,2);
const co2=JSON.parse(executedTool('carbon_summary',{items:[{name:'A',kgCO2e:1.25},{name:'B',kgCO2e:2.5}]}));
assert.equal(co2.total,3.75);
const invalidCtx=vm.runInNewContext(`(function(){${find('Validate Input').parameters.jsCode}})()`,{$input:{first:()=>({json:{body:{message:'',sessionId:'bad!'}}})}})[0].json;
assert.equal(invalidCtx.valid,false);
assert.equal(check.catalog.tours[0].carbon,null); // missing does not mean zero
assert.equal(JSON.parse(executedTool('carbon_summary',{items:[{kgCO2e:null}]})).status,'invalid_input');
assert.equal(JSON.parse(executedTool('budget_estimate',{items:[{name:'Unknown',unitCost:null,quantity:1}]})).status,'invalid_item');
console.log(`OK: ${wf.nodes.length} nodes; links and simulated tool checks passed. This is NOT a live n8n/DB test.`);

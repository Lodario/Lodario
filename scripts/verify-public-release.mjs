import assert from 'node:assert/strict';
const origin='https://lodario.vercel.app';
const routes=['/','/privacy','/terms','/cookies','/health-disclaimer','/support','/reset-password','/guardian'];
const results=await Promise.all(routes.map(async route=>{
  const response=await fetch(origin+route,{signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200,route);
  const html=await response.text();assert.match(html,/Lodario/);assert.doesNotMatch(html,/18\+ public beta/i);
  return {route,status:response.status};
}));
const health=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(15000)});
assert.equal(health.status,200);assert.equal((await health.json()).status,'ok');
for(const route of ['/api/account/export','/api/account/delete','/api/feedback']) {
  const response=await fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,401,route+' must require authentication');results.push({route,status:response.status});
}
console.log(JSON.stringify({publicRoutes:results,health:'ok',sentEmails:0}));

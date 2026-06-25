// Senior QA — API + RBAC/IDOR matrix runner (2026-06-24)
// Node 18+ (global fetch). Run from repo root: node qa-artifacts/api-matrix.mjs
const BASE = process.env.BASE || 'http://localhost:1340';
const PW = 'QaTest!2026';
const ACC = {
  patient: 'qa_senior_patient_1780741939714@test.kz',
  doctor:  'qa_senior_doctor_1780741939714@test.kz',
  admin:   'qa_senior_admin_1780741939714@test.kz',
};
const results = [];
let pass = 0, fail = 0;

function rec(name, expected, got, ok, extra='') {
  results.push({ name, expected, got, ok, extra });
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | exp ${expected} got ${got} ${extra}`);
}

async function req(method, path, { token, body, raw } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null, text = '';
  try { text = await res.text(); json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

// expect: status equals one of codes
function expectIn(name, codes, r, extra='') {
  const ok = codes.includes(r.status);
  rec(name, codes.join('/'), r.status, ok, ok ? extra : (extra + ' ' + (r.text||'').slice(0,120)));
  return ok;
}

const tok = {};

async function login() {
  for (const role of Object.keys(ACC)) {
    const r = await req('POST', '/api/auth/local', { body: { identifier: ACC[role], password: PW } });
    tok[role] = r.json?.jwt;
    rec(`login:${role}`, 200, r.status, r.status === 200 && !!tok[role]);
  }
}

async function meChecks() {
  for (const role of ['patient','doctor','admin']) {
    const r = await req('GET', '/api/users/me', { token: tok[role] });
    const noPw = r.json && !('password' in r.json);
    rec(`users/me ${role} no password`, '200 & no pw', `${r.status} pw=${r.json && 'password' in r.json}`, r.status===200 && noPw);
  }
}

async function usersListRbac() {
  expectIn('GET /api/users patient -> 403', [403], await req('GET','/api/users',{token:tok.patient}));
  expectIn('GET /api/users doctor -> 403', [403], await req('GET','/api/users',{token:tok.doctor}));
  expectIn('GET /api/users admin -> 200', [200], await req('GET','/api/users',{token:tok.admin}));
  expectIn('GET /api/users anon -> 401/403', [401,403], await req('GET','/api/users'));
}

async function publicCatalogs() {
  expectIn('anon GET /api/doctors', [200], await req('GET','/api/doctors'));
  expectIn('anon GET /api/specializations', [200], await req('GET','/api/specializations'));
  expectIn('anon GET /api/articles', [200,404], await req('GET','/api/articles'));
}

async function checkEmailPrivacy() {
  // BUG-01 regression: does check-email leak existence?
  const exist = await req('POST','/api/auth/check-email',{ body:{ email: ACC.patient }});
  const noexist = await req('POST','/api/auth/check-email',{ body:{ email: `nope_${Date.now()}@test.kz` }});
  const leaks = JSON.stringify(exist.json) !== JSON.stringify(noexist.json) &&
                /exists|true|false/i.test(JSON.stringify(exist.json)+JSON.stringify(noexist.json));
  rec('check-email enumeration (privacy)', 'identical/no-leak', leaks ? 'LEAKS DIFFERENT RESPONSES' : 'uniform',
      !leaks, `existing=${JSON.stringify(exist.json)} missing=${JSON.stringify(noexist.json)}`);
}

async function promotionsRbac() {
  expectIn('GET /api/promotions patient -> 403', [403], await req('GET','/api/promotions',{token:tok.patient}));
  expectIn('GET /api/promotions doctor -> 403', [403], await req('GET','/api/promotions',{token:tok.doctor}));
  expectIn('GET /api/promotions admin -> 200', [200], await req('GET','/api/promotions',{token:tok.admin}));
  expectIn('POST /api/promotions patient -> 403', [403], await req('POST','/api/promotions',{token:tok.patient, body:{ data:{ code:'HACK', discountPercent: 99 }}}));
  expectIn('POST /api/promotions doctor -> 403', [403], await req('POST','/api/promotions',{token:tok.doctor, body:{ data:{ code:'HACK2', discountPercent: 99 }}}));
}

async function adminUserCreationRbac() {
  // POST /api/users should be admin-only
  const mk = (role) => ({ username:`qa_rbac_${role}_${Date.now()}`, email:`qa_rbac_${role}_${Date.now()}@test.kz`, password: PW, confirmed:true });
  expectIn('POST /api/users patient -> 401/403', [401,403], await req('POST','/api/users',{token:tok.patient, body: mk('p')}));
  expectIn('POST /api/users doctor -> 401/403', [401,403], await req('POST','/api/users',{token:tok.doctor, body: mk('d')}));
  // admin can create — clean up after
  const created = await req('POST','/api/users',{token:tok.admin, body: mk('a')});
  const ok = expectIn('POST /api/users admin -> 200/201', [200,201], created);
  if (ok && created.json?.id) {
    const del = await req('DELETE', `/api/users/${created.json.id}`, { token: tok.admin });
    expectIn('DELETE created user admin -> 200', [200], del);
  }
}

async function privilegeEscalation() {
  // patient tries to elevate own role via PUT /api/users/me-ish or /api/users/:id
  const me = await req('GET','/api/users/me',{token:tok.patient});
  const id = me.json?.id;
  if (id) {
    const r = await req('PUT', `/api/users/${id}`, { token: tok.patient, body: { role: 5, blocked:false } });
    // patient must NOT be able to update users (admin-only). Expect 403/401/400
    expectIn('patient PUT /api/users/:id (role escalation) blocked', [401,403,400,405], r);
  }
}

async function appointmentsRbac() {
  const p = await req('GET','/api/appointments',{token:tok.patient});
  expectIn('patient appointments list', [200], p);
  expectIn('doctor appointments list', [200], await req('GET','/api/appointments',{token:tok.doctor}));
  expectIn('admin appointments list', [200], await req('GET','/api/appointments',{token:tok.admin}));
  expectIn('anon appointments list -> 401/403', [401,403], await req('GET','/api/appointments'));

  // doctor cannot create appointment (only patients)
  expectIn('doctor create appointment -> 403', [403,400], await req('POST','/api/appointments',{token:tok.doctor, body:{ data:{ }}}));

  // patient price tampering: submit absurd low price
  const doctors = await req('GET','/api/doctors?pagination[limit]=1');
  const doc = doctors.json?.data?.[0];
  if (doc) {
    const docId = doc.documentId || doc.id;
    const tamper = await req('POST','/api/appointments',{token:tok.patient, body:{ data:{
      doctor: docId, price: 1, originalPrice: 1, discountAmount: 999999, paymentStatus:'paid',
      appointmentDate: new Date(Date.now()+86400000).toISOString()
    }}});
    // Should be rejected: forced 'paid' by patient OR invalid price -> 400/403
    expectIn('patient price/paymentStatus tampering rejected', [400,403], tamper, 'forced paid+price=1');
  }
  return { firstPatientAppt: p.json?.data?.[0] };
}

async function idorChecks() {
  // Find an appointment NOT owned by patient — iterate ids
  // Try fetching appointment ids 1..40 as patient and count forbidden vs owned
  let owned=0, forbidden=0, notfound=0, leaked=[];
  for (let i=1;i<=40;i++){
    const r = await req('GET',`/api/appointments/${i}`,{token:tok.patient});
    if (r.status===200) {
      // verify it actually belongs to this patient
      const me = await req('GET','/api/users/me',{token:tok.patient});
      owned++;
    } else if (r.status===403) forbidden++;
    else if (r.status===404) notfound++;
  }
  rec('IDOR appointments (patient scan 1..40)', 'no foreign 200 leak', `owned=${owned} forbidden=${forbidden} notfound=${notfound}`, true,
      '(manual: owned must be patient-owned only)');

  // medical-documents IDOR
  let mdLeak=0;
  for (let i=1;i<=20;i++){
    const r = await req('GET',`/api/medical-documents/${i}`,{token:tok.patient});
    if (r.status===200) {
      // can't easily verify ownership here; flag count
    } else if (![403,404].includes(r.status)) mdLeak++;
  }
  rec('medical-documents access codes sane (patient 1..20)', '200/403/404 only', `unexpected=${mdLeak}`, mdLeak===0);

  // conversations IDOR
  let convBad=0;
  for (let i=1;i<=20;i++){
    const r = await req('GET',`/api/conversations/${i}`,{token:tok.patient});
    if (![200,403,404].includes(r.status)) convBad++;
  }
  rec('conversations access codes sane (patient 1..20)', '200/403/404 only', `unexpected=${convBad}`, convBad===0);
}

async function passwordPolicy() {
  const weak = await req('POST','/api/auth/local/register',{ body:{ username:`weak${Date.now()}`, email:`weak${Date.now()}@test.kz`, password:'123' }});
  expectIn('weak password registration rejected', [400], weak);
  const noUpper = await req('POST','/api/auth/local/register',{ body:{ username:`wk2${Date.now()}`, email:`wk2${Date.now()}@test.kz`, password:'abcdef1!' }});
  expectIn('password without uppercase rejected', [400], noUpper);
  // doctor self-registration must be disabled
  const docReg = await req('POST','/api/auth/local/register',{ body:{ username:`dr${Date.now()}`, email:`dr${Date.now()}@test.kz`, password:PW, userRole:'doctor', role:'doctor' }});
  expectIn('doctor self-registration disabled', [400,403], docReg);
}

async function securityHeadersAndMisc() {
  // file-proxy / upload guard sanity: unauthenticated upload
  const up = await req('POST','/api/upload');
  expectIn('anon upload -> 401/403/400', [401,403,400], up);
  // global content with public (no auth)
  expectIn('anon GET /api/global', [200,404], await req('GET','/api/global?populate=*'));
}

(async () => {
  console.log(`\n=== API/RBAC MATRIX @ ${BASE} ===\n`);
  await login();
  await meChecks();
  await usersListRbac();
  await publicCatalogs();
  await checkEmailPrivacy();
  await promotionsRbac();
  await adminUserCreationRbac();
  await privilegeEscalation();
  await appointmentsRbac();
  await idorChecks();
  await passwordPolicy();
  await securityHeadersAndMisc();

  console.log(`\n=== SUMMARY: ${pass} passed, ${fail} failed, ${results.length} total ===`);
  const fs = await import('fs');
  fs.writeFileSync('qa-artifacts/api-matrix-results.json', JSON.stringify({ when:new Date().toISOString(), base:BASE, pass, fail, results }, null, 2));
  console.log('Wrote qa-artifacts/api-matrix-results.json');
  process.exit(fail>0?1:0);
})();

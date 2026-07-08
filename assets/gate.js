// 접속 게이트 + 데이터 로드
// 1) 입력한 비밀번호의 SHA-256 해시를 PW_HASH와 대조 (통과하면 같은 탭 세션 동안 유지)
// 2) 구글 시트 게시 CSV(CSV_URL)를 내려받아 buildDATA(csv2data.js)로 변환 → runApp(app.js) 실행
// 비밀번호 변경법: 터미널에서  printf '%s' '새비밀번호' | shasum -a 256  결과를 PW_HASH에 넣는다.
'use strict';
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRL27WDmh2V_7dT8Zs-HeBVmd7DvNmImFb5P3uDf6k8IUoDZ4E4HuB-yeKVGrnHTHI0Ci14KjFA_wE2/pub?output=csv";
const PW_HASH = "158a323a7ba44870f23d96f1516dd70aa48e9a72db4ebb026b0a89e212a208ab";
const $g = id => document.getElementById(id);
async function sha256(s){ const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
async function unlock(pw, silent){
  const msg = $g('msg');
  if(!pw){ if(!silent){ msg.className='gmsg err'; msg.textContent='비밀번호를 입력해 주세요.'; } return; }
  const h = await sha256(pw.normalize('NFC'));
  if(h !== PW_HASH){ sessionStorage.removeItem('qhs_gate'); if(!silent){ msg.className='gmsg err'; msg.textContent='비밀번호가 올바르지 않습니다.'; $g('pw').select(); } return; }
  sessionStorage.setItem('qhs_gate', pw);
  $g('gate').style.display='none';
  $g('approot').style.display='';
  $g('app').innerHTML = '<div class="loading">시트에서 최신 일정을 불러오는 중…</div>';
  try{
    const csv = await fetch(CSV_URL + '&_=' + Date.now(), {cache:'no-store'}).then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); });
    const DATA = buildDATA(csv);
    if(!DATA.gisu || !DATA.gisu.length) throw new Error('데이터가 비어 있습니다');
    runApp(DATA);
  }catch(e){
    $g('app').innerHTML = '<div class="loaderr"><b>일정을 불러오지 못했습니다.</b><br>인터넷 연결을 확인하고 새로고침해 주세요.<br><small>'+String((e&&e.message)||e)+'</small></div>';
  }
}
$g('go').addEventListener('click', ()=>unlock($g('pw').value.trim(), false));
$g('pw').addEventListener('keydown', e=>{ if(e.key==='Enter') unlock($g('pw').value.trim(), false); });
const _saved = sessionStorage.getItem('qhs_gate'); if(_saved) unlock(_saved, true);

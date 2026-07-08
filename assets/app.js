// 일정표 앱 렌더링: 과목별 표 · 강사 이름 검색 · 이동 지도(Leaflet)
// gate.js 가 시트 CSV를 csv2data.js(buildDATA)로 변환한 뒤 runApp(DATA)를 호출한다.
function runApp(DATA){
'use strict';
const WD = ['일','월','화','수','목','금','토'];
const SUBJECTS = ['국어','영어','수학','사회','과학'];
const SESS = {
  1: [{c:'23~24', t:'19:10~20:50', p:'학생 질문 중심 교과 수업 설계'}],
  2: [{c:'25~27', t:'09:00~11:30', p:'학생 질문 중심 프로젝트 수업 및 평가 설계'},
      {c:'28~29', t:'13:00~14:40', p:'독서활동 연계 학생 질문 중심 수업 및 평가 설계'},
      {c:'30~32', t:'15:00~17:30', p:'질문 중심 서·논술형 평가문항 및 채점기준 개발'}],
  3: [{c:'33~34', t:'08:00~09:40', p:'질문 중심 수업·평가 설계 실습(Ⅱ)'},
      {c:'35~36', t:'10:00~11:40', p:'질문 중심 수업·평가 결과 나눔(Ⅱ)'}]
};
const RANGE = {2:'25~32', 3:'33~36'};
const SPECIAL = {c:'21~22', t:'16:00~17:40', p:'교과공통 특강'};
const PLACEHOLDER = ['미정','보조없음'];

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function parseName(raw){
  const m = raw.match(/\((\d+\/\d+\s*중복)\)/);
  return { base: raw.replace(/\s*\(\d+\/\d+\s*중복\)/,'').trim(), ann: m ? m[1] : null };
}
function cleanKey(raw){
  // 소속 괄호(예: (교원대),(상명대))는 보존해 동일 성명의 소속 구분을 유지한다.
  // '중복' 주석은 parseName 이 이미 제거하므로 여기서 별도 처리 불필요.
  return parseName(raw).base.replace(/교수님/g,'').replace(/\s/g,'');
}
function nameHTML(raw){
  const {base, ann} = parseName(raw);
  return esc(base) + (ann ? ' <span class="dup">'+esc(ann)+'</span>' : '');
}
function fmtDate(iso, withYear){
  const [y,mo,d] = iso.split('-').map(Number);
  const wd = WD[new Date(y, mo-1, d).getDay()];
  return (withYear ? y+'. ' : '') + mo + '. ' + d + '.(' + wd + ')';
}
function resolve(names, n){
  const list = (names||[]).filter(x=>x && x.trim());
  if (!list.length) return {m:'none', a:[]};
  if (list.every(x=>PLACEHOLDER.includes(x))) return {m:'text', a:list};
  if (list.length === 1) return {m:'all', a:list};
  if (list.length === n) return {m:'per', a:list};
  return {m:'ambig', a:list};
}
function partnerText(other, i){
  if (other.m === 'per') return parseName(other.a[i]).base;
  if (other.m === 'all') return parseName(other.a[0]).base;
  if (other.m === 'ambig') return other.a.map(x=>parseName(x).base).join(' · ');
  return null;
}

// ---------- 검색 인덱스 ----------
const INDEX = [];
DATA.gisu.forEach((g, gi) => {
  if (g.prof) INDEX.push({ key: cleanKey(g.prof), raw: g.prof, subj: '특강',
    gisu: g.no, date: g.dates[0], time: SPECIAL.t, c: SPECIAL.c,
    p: SPECIAL.p, role: '특강', partner: null, amb: false, ord: gi*100 });
  SUBJECTS.forEach(subj => {
    (g.s[subj]||[]).forEach((dd, di) => {
      const day = di+1, sess = SESS[day], n = sess.length;
      ['ju','bo'].forEach(role => {
        const r = resolve(dd[role], n);
        const other = resolve(dd[role==='ju'?'bo':'ju'], n);
        const roleName = role==='ju' ? '주강사' : '보조강사';
        if (r.m === 'per' || r.m === 'all'){
          for (let i=0;i<n;i++){
            const raw = r.m==='per' ? r.a[i] : r.a[0];
            INDEX.push({ key: cleanKey(raw), raw, subj, gisu: g.no,
              date: g.dates[di], time: sess[i].t, c: sess[i].c, p: sess[i].p,
              role: roleName, partner: partnerText(other, i), amb: false,
              ord: gi*100 + day*10 + i });
          }
        } else if (r.m === 'ambig'){
          const seen = new Set();
          r.a.forEach(raw => {
            const k = cleanKey(raw);
            if (seen.has(k)) return; seen.add(k);
            INDEX.push({ key: k, raw, subj, gisu: g.no,
              date: g.dates[di], time: day===2?'09:00~17:30':'08:00~11:40',
              c: RANGE[day], p: day+'일차 (주·보 각 '+r.a.length+'명 배정, 세션별 담당 구분 없음)',
              role: roleName, partner: partnerText(other, 0), amb: true, grp: r.a.length,
              ord: gi*100 + day*10 });
          });
        }
      });
    });
  });
});

// ---------- 과목별 뷰 ----------
function roleCellHTML(r){
  if (r.m === 'none') return '<span class="na">—</span>';
  if (r.m === 'text') return '<span class="na">'+esc(r.a.join(', '))+'</span>';
  if (r.m === 'ambig') return r.a.map(nameHTML).join(' <span class="sep">·</span> ') +
      ' <span class="co">'+r.a.length+'명</span>';
  return nameHTML(r.a[0]);
}
function renderSubject(subj){
  let h = '';
  const roster = [...new Map(INDEX.filter(e=>e.subj===subj).map(e=>[e.key, parseName(e.raw).base])).values()];
  h += '<div class="roster"><span class="roster-label">'+esc(subj)+'과 강사</span>' +
       roster.map(n=>'<button class="chip" data-name="'+esc(n)+'">'+esc(n)+'</button>').join('') + '</div>';
  DATA.gisu.forEach(g => {
    const dd = g.s[subj]; if (!dd) return;
    h += '<section class="card" data-subj="'+subj+'">';
    h += '<div class="card-head"><div class="card-title"><span class="gisu">'+esc(g.no)+'</span> '+esc(g.loc)+
         ' <span class="st st-'+(g.st==='확정'?'ok':'chk')+'">'+g.st+'</span></div>';
    h += '<div class="card-date">'+fmtDate(g.dates[0],true)+' ~ '+fmtDate(g.dates[2],false)+'</div></div>';
    h += '<div class="tbl-wrap"><table class="t-sched"><thead><tr><th>일차·날짜</th><th>시간</th><th>차시</th><th>강의 내용</th><th>주강사</th><th>보조강사</th></tr></thead><tbody>';
    // 1일차: 특강 + 23~24
    h += '<tr><td rowspan="2" class="dcell"><b>1일차</b><br>'+fmtDate(g.dates[0],false)+'</td>';
    h += '<td>'+SPECIAL.t+'</td><td>'+SPECIAL.c+'</td><td class="topic">'+SPECIAL.p+'</td>';
    h += '<td colspan="2" class="prof">'+(g.prof?esc(g.prof):'<span class="na">—</span>')+'</td></tr>';
    const s1 = SESS[1][0], r1j = resolve(dd[0].ju,1), r1b = resolve(dd[0].bo,1);
    h += '<tr><td>'+s1.t+'</td><td>'+s1.c+'</td><td class="topic">'+s1.p+'</td><td class="rc">'+roleCellHTML(r1j)+'</td><td class="rc">'+roleCellHTML(r1b)+'</td></tr>';
    // 2·3일차
    [2,3].forEach(day => {
      const sess = SESS[day], n = sess.length, d0 = dd[day-1];
      const rj = resolve(d0.ju, n), rb = resolve(d0.bo, n);
      for (let i=0;i<n;i++){
        h += '<tr>';
        if (i===0) h += '<td rowspan="'+n+'" class="dcell"><b>'+day+'일차</b><br>'+fmtDate(g.dates[day-1],false)+'</td>';
        h += '<td>'+sess[i].t+'</td><td>'+sess[i].c+'</td><td class="topic">'+sess[i].p+'</td>';
        [rj,rb].forEach(r => {
          if (r.m === 'per') h += '<td class="rc">'+nameHTML(r.a[i])+'</td>';
          else if (i===0) h += '<td rowspan="'+n+'" class="span rc">'+roleCellHTML(r)+'</td>';
        });
        h += '</tr>';
      }
    });
    h += '</tbody></table></div></section>';
  });
  return h;
}

// ---------- 이동 지도 ----------
let pendingVisits = null;
function buildVisits(list){
  const first = new Map();
  list.forEach(e => {
    if (!first.has(e.gisu) || e.date < first.get(e.gisu)) first.set(e.gisu, e.date);
  });
  return [...first.entries()]
    .map(([no, d]) => ({ no, d, g: DATA.gisu.find(x => x.no === no) }))
    .sort((a,b) => a.d.localeCompare(b.d) || parseInt(a.no) - parseInt(b.no));
}
function mapHTML(){
  return '<section class="card mapcard"><div class="maphead">이동 지도 <span class="maphint">숫자 = 방문 순서 · 점선 = 순서 연결(실제 경로 아님)</span></div>' +
         '<div id="lmap"></div><div class="maplegend">마커를 누르면 기수 정보와 카카오맵 길찾기 링크가 열립니다. 지도 배경은 인터넷 연결 시 표시됩니다.</div></section>';
}
function initMap(){
  if (!pendingVisits) return;
  const el = document.getElementById('lmap');
  if (!el || !window.L) return;
  try {
    const map = L.map(el, { scrollWheelZoom:false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom:19, attribution:'&copy; OpenStreetMap contributors' }).addTo(map);
    const pts = [];
    pendingVisits.forEach((v,i) => {
      const g = v.g; if (g.lat == null) return;
      const ll = [g.lat, g.lng]; pts.push(ll);
      const icon = L.divIcon({ className:'', html:'<div class="mk">'+(i+1)+'</div>',
        iconSize:[26,26], iconAnchor:[13,13], popupAnchor:[0,-15] });
      const kakao = 'https://map.kakao.com/link/to/' + encodeURIComponent(g.loc) + ',' + g.lat + ',' + g.lng;
      L.marker(ll, { icon }).addTo(map).bindPopup(
        '<b>' + (i+1) + '. ' + esc(v.no) + ' · ' + esc(g.loc) + '</b><br>' +
        fmtDate(g.dates[0], false) + ' ~ ' + fmtDate(g.dates[2], false) +
        '<br><span class="popaddr">' + esc(g.addr || '') + '</span><br>' +
        '<a href="' + kakao + '" target="_blank" rel="noopener">카카오맵 길찾기 ↗</a>');
    });
    if (!pts.length){ el.innerHTML = '<div class="mapfail">표시할 장소가 없습니다</div>'; return; }
    if (pts.length > 1) L.polyline(pts, { color:'#0f172a', weight:2.5, dashArray:'6 8', opacity:0.75 }).addTo(map);
    if (pts.length === 1) map.setView(pts[0], 12);
    else map.fitBounds(L.latLngBounds(pts).pad(0.18));
    el.addEventListener('click', () => map.scrollWheelZoom.enable(), { once:true });
  } catch(err){
    el.innerHTML = '<div class="mapfail">지도를 불러오지 못했습니다 (인터넷 연결 필요)</div>';
  }
}

// ---------- 검색 뷰 ----------
function renderSearch(q){
  pendingVisits = null;
  const nq = q.replace(/\s/g,'');
  const hits = INDEX.filter(e => e.key.includes(nq));
  if (!hits.length){
    const all = [...new Map(INDEX.map(e=>[e.key, parseName(e.raw).base])).values()].sort((a,b)=>a.localeCompare(b,'ko'));
    return '<div class="empty"><p>‘'+esc(q)+'’ 일치 강사가 없습니다. 아래에서 선택해 보세요.</p><div class="roster">' +
      all.map(n=>'<button class="chip" data-name="'+esc(n)+'">'+esc(n)+'</button>').join('') + '</div></div>';
  }
  const groups = new Map();
  hits.forEach(e => { if(!groups.has(e.key)) groups.set(e.key, []); groups.get(e.key).push(e); });
  let h = '';
  if (groups.size === 1){
    pendingVisits = buildVisits([...groups.values()][0]);
    h += mapHTML();
  }
  groups.forEach(list => {
    list.sort((a,b)=> a.date===b.date ? a.ord-b.ord : a.date.localeCompare(b.date));
    const variants = [...new Set(list.map(e=>parseName(e.raw).base))];
    h += '<section class="card person"><div class="card-head"><div class="card-title">'+esc(variants.join(' · '))+
         ' <span class="cnt">'+list.length+'건</span></div></div>';
    h += '<div class="tbl-wrap"><table class="t-search"><thead><tr><th>기수</th><th>과목</th><th>날짜</th><th>시간</th><th>차시</th><th>강의 내용</th><th>역할</th><th>함께</th></tr></thead><tbody>';
    list.forEach(e => {
      const g = DATA.gisu.find(x=>x.no===e.gisu);
      const ann = parseName(e.raw).ann;
      h += '<tr><td class="nowrap"><b>'+esc(e.gisu)+'</b><br><span class="loc">'+esc(g.loc)+'</span></td>';
      h += '<td><span class="subj-tag" data-subj="'+esc(e.subj)+'">'+esc(e.subj)+'</span></td>';
      h += '<td class="nowrap">'+fmtDate(e.date,false)+'</td><td class="nowrap">'+e.time+'</td><td class="nowrap">'+e.c+(e.amb?' <span class="co">'+e.grp+'명</span>':'')+'</td>';
      h += '<td class="topic">'+esc(e.p)+'</td>';
      h += '<td><span class="role role-'+(e.role==='주강사'?'ju':e.role==='보조강사'?'bo':'sp')+'">'+e.role+'</span>'+(ann?' <span class="dup">'+esc(ann)+'</span>':'')+'</td>';
      h += '<td>'+(e.partner?esc(e.partner):'<span class="na">—</span>')+'</td></tr>';
    });
    h += '</tbody></table></div></section>';
  });
  return h;
}

// ---------- 상태·이벤트 ----------
const app = document.getElementById('app');
const tabs = document.getElementById('tabs');
const q = document.getElementById('q');
const clearBtn = document.getElementById('clear');
let currentSubj = localStorage.getItem('qhs_subject') || '국어';
if (!SUBJECTS.includes(currentSubj)) currentSubj = '국어';

function drawTabs(active){
  tabs.innerHTML = SUBJECTS.map(s=>'<button class="tab'+(s===active?' on':'')+'" data-subj="'+s+'">'+s+'</button>').join('');
}
function showSubject(s){
  currentSubj = s; localStorage.setItem('qhs_subject', s);
  pendingVisits = null;
  drawTabs(s); app.innerHTML = renderSubject(s);
}
function showSearch(){
  const v = q.value.trim();
  if (!v){ showSubject(currentSubj); return; }
  drawTabs(null); app.innerHTML = renderSearch(v);
  initMap();
}
tabs.addEventListener('click', e => {
  const b = e.target.closest('.tab'); if (!b) return;
  q.value = ''; showSubject(b.dataset.subj);
});
q.addEventListener('input', showSearch);
clearBtn.addEventListener('click', ()=>{ q.value=''; showSubject(currentSubj); });
app.addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (!c) return;
  q.value = c.dataset.name; showSearch(); window.scrollTo({top:0, behavior:'smooth'});
});
showSubject(currentSubj);
}

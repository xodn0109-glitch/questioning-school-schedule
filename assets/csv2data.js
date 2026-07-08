// CSV(구글시트 게시) → 사이트 DATA 변환 로직. 브라우저·Node 공용.
// 집합연수(장소 [확정]/[확인])만, 비대면(zoom/빈 장소) 제외.

const VENUES = {
  '1기':{lat:37.522333,lng:127.116549,addr:'서울 송파구 올림픽로 448'},
  '2기':{lat:37.156887,lng:127.090893,addr:'경기 오산시 경기동로186번길 8'},
  '3기':{lat:36.757405,lng:127.224081,addr:'충남 천안시 동남구 성남면 소노로 1'},
  '4기':{lat:37.277730,lng:127.032440,addr:'경기 수원시 팔달구 중부대로 150'},
  '5기':{lat:37.645083,lng:127.682021,addr:'강원 홍천군 서면 한치골길 264'},
  '6기':{lat:35.950345,lng:126.975985,addr:'전북 익산시 동서로 380'},
  '7기':{lat:34.745787,lng:127.751884,addr:'전남 여수시 오동도로 61-13'},
  '8기':{lat:35.874356,lng:128.659807,addr:'대구 수성구 팔현길 212'},
  '9기':{lat:35.226023,lng:128.885084,addr:'경남 김해시 김해대로 2360'},
  '10기':{lat:35.160948,lng:129.167194,addr:'부산 해운대구 해운대해변로298번길 33'},
};
const SUBJECTS_CSV=['국어','영어','수학','사회','과학'];
const SUBJ_COL={'국어':6,'영어':12,'수학':18,'사회':24,'과학':30}; // CSV 0-based 시작열(1일차 주)

// --- RFC4180 CSV 파서 (따옴표 안 콤마·줄바꿈 처리) ---
function parseCSV(text){
  const rows=[]; let row=[], cur='', i=0, q=false;
  text=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  while(i<text.length){
    const c=text[i];
    if(q){
      if(c==='"'){ if(text[i+1]==='"'){cur+='"';i+=2;continue;} q=false;i++;continue; }
      cur+=c; i++; continue;
    }
    if(c==='"'){ q=true; i++; continue; }
    if(c===','){ row.push(cur); cur=''; i++; continue; }
    if(c==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; i++; continue; }
    cur+=c; i++;
  }
  if(cur!==''||row.length){ row.push(cur); rows.push(row); }
  return rows;
}

// --- 셀 안 여러 이름 → 배열 ('('로 시작하는 줄은 앞 이름에 병합) ---
function cellNames(v){
  const L=(v==null?'':String(v)).split('\n').map(s=>s.trim()).filter(Boolean);
  const out=[];
  for(const l of L){ if(l.startsWith('(')&&out.length) out[out.length-1]+=' '+l; else out.push(l); }
  return out;
}

function buildDATA(csvText){
  const rows=parseCSV(csvText);
  const gisu=[];
  for(const r of rows){
    const no=(r[1]||'').trim();
    const loc=(r[3]||'').trim();
    if(!/^\d+기$/.test(no)) continue;            // 기수 행만
    if(!/^\[(확정|확인)\]/.test(loc)) continue;   // 집합연수만 (비대면 제외)
    const m=(r[2]||'').match(/2026\.\s*(\d+)\.\s*(\d+)/);
    let dates=['','',''];
    if(m){ const s=new Date(2026,+m[1]-1,+m[2]); dates=[0,1,2].map(k=>{const d=new Date(s.getTime()+k*864e5);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}); }
    const st = loc.startsWith('[확인]')?'확인':'확정';
    const locName = loc.replace(/^\[(확정|확인)\]\s*/,'').trim();
    const prof=(r[5]||'').trim();
    const s={};
    for(const subj of SUBJECTS_CSV){
      const b=SUBJ_COL[subj]; const days=[];
      for(let d=0;d<3;d++) days.push({ju:cellNames(r[b+d*2]),bo:cellNames(r[b+d*2+1])});
      s[subj]=days;
    }
    const v=VENUES[no]||{lat:null,lng:null,addr:''};
    gisu.push({no,dates,loc:locName,st,prof,lat:v.lat,lng:v.lng,addr:v.addr,s});
  }
  return {gisu};
}

if(typeof module!=='undefined') module.exports={parseCSV,cellNames,buildDATA};

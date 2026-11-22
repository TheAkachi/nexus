// Horário de funcionamento no fuso America/Sao_Paulo: "aberto agora", "fecha às", "abre às" e a semana em linhas prontas.
// Linhas do banco (business_hours): {weekday 0=domingo, opens 'HH:MM', closes 'HH:MM' ou '24:00'}. closes menor ou igual
// a opens passa da meia-noite; 00:00 a 24:00 é aberto o dia todo. Em feriado nacional o status fica null ("consulte").
const ZONE='America/Sao_Paulo';
const DIAS=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
const minutes=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
export const clock=total=>{const m=((total%1440)+1440)%1440,h=Math.floor(m/60),r=m%60;return r?`${h}h${String(r).padStart(2,'0')}`:`${h}h`;};

// Data, dia da semana e minuto do dia em São Paulo.
export function localNow(now=new Date()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(now).map(p=>[p.type,p.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,weekday:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday),minute:Number(parts.hour)*60+Number(parts.minute)};
}

// Feriados nacionais (leis 662/1949, 6.802/1980, 14.759/2023 e Sexta-feira da Paixão). Carnaval e Corpus Christi são ponto
// facultativo, não feriado nacional.
const FIXOS={'01-01':'Confraternização Universal','04-21':'Tiradentes','05-01':'Dia do Trabalho','09-07':'Independência do Brasil','10-12':'Nossa Senhora Aparecida','11-02':'Finados','11-15':'Proclamação da República','11-20':'Dia Nacional de Zumbi e da Consciência Negra','12-25':'Natal'};
function easter(year) {
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  return new Date(Date.UTC(year,Math.floor((h+l-7*m+114)/31)-1,((h+l-7*m+114)%31)+1));
}
export function nationalHoliday(date) {
  const [year]=date.split('-').map(Number);
  if(FIXOS[date.slice(5)])return FIXOS[date.slice(5)];
  const friday=easter(year);friday.setUTCDate(friday.getUTCDate()-2);
  return friday.toISOString().slice(0,10)===date?'Sexta-feira da Paixão':'';
}

// Horários do acervo ([{dia:'SEG', horas:['08:00 - 17:00']}], 'Aberto 24h', 'Fechado') em linhas do banco.
const SIGLAS={DOM:0,SEG:1,TER:2,QUA:3,QUI:4,SEX:5,'SÁB':6,SAB:6};
export function parseAcervoHours(horarios=[]) {
  const rows=[];
  for(const {dia,horas} of horarios) {
    const weekday=SIGLAS[String(dia).toUpperCase()];if(weekday===undefined)continue;
    for(const h of horas||[]) {
      if(/aberto\s*24\s*h/i.test(h)){rows.push({weekday,opens:'00:00',closes:'24:00'});continue;}
      const m=/^\s*(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})\s*$/.exec(h);
      if(m)rows.push({weekday,opens:`${m[1].padStart(2,'0')}:${m[2]}`,closes:m[3]==='24'?'24:00':`${m[3].padStart(2,'0')}:${m[4]}`});
    }
  }
  return rows;
}

// Intervalos em minutos a partir da meia-noite de hoje, de ontem até daqui a 7 dias, já unidos quando encostam.
function intervals(rows,today) {
  const list=[];
  for(let d=-1;d<=7;d++){const w=(today+d+7)%7;for(const r of rows.filter(x=>x.weekday===w)){const o=minutes(r.opens),c=minutes(r.closes);list.push([d*1440+o,d*1440+(c>o?c:c+1440)]);}}
  list.sort((a,b)=>a[0]-b[0]);
  const merged=[];for(const [s,e] of list){const last=merged.at(-1);if(last&&s<=last[1])last[1]=Math.max(last[1],e);else merged.push([s,e]);}
  return merged;
}

// Semana de segunda a domingo em linhas prontas ('8h às 18h', '8h às 12h e 14h às 18h', 'Aberto 24h', 'Fechado').
export function weekLabels(rows,today=-1) {
  if(!rows.length)return [];
  return [1,2,3,4,5,6,0].map(w=>{
    const day=rows.filter(r=>r.weekday===w).sort((a,b)=>a.opens.localeCompare(b.opens));
    const label=!day.length?'Fechado':day.some(r=>r.opens==='00:00'&&r.closes==='24:00')?'Aberto 24h':day.map(r=>`${clock(minutes(r.opens))} às ${clock(minutes(r.closes))}`).join(' e ');
    return {day:DIAS[w],label,today:w===today};
  });
}

// Status de agora: {openNow, closesAt, opensAt, opensDay, holiday}. Sem horário estruturado, tudo vazio e openNow null.
export function hoursStatus(rows,now=new Date()) {
  const {date,weekday,minute}=localNow(now),holiday=nationalHoliday(date);
  const empty={openNow:null,closesAt:'',opensAt:'',opensDay:'',holiday};
  if(!rows.length||holiday)return empty;
  const list=intervals(rows,weekday),current=list.find(([s,e])=>s<=minute&&minute<e);
  if(current)return {...empty,openNow:true,closesAt:current[1]>=minute+7*1440?'':clock(current[1])};
  const next=list.find(([s])=>s>minute);
  if(!next)return {...empty,openNow:false};
  const day=Math.floor(next[0]/1440);
  return {...empty,openNow:false,opensAt:clock(next[0]),opensDay:day===0?'hoje':day===1?'amanhã':DIAS[(weekday+day)%7]};
}

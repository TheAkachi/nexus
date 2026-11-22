import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hoursStatus,parseAcervoHours,weekLabels,nationalHoliday,localNow} from '../../api/lib/horario.mjs';

// "Aberto agora", "fecha às" e "abre às" no fuso America/Sao_Paulo, com relógio fixo.
const at=s=>new Date(s);
const comercial=parseAcervoHours([{dia:'SEG',horas:['08:00 - 18:00']},{dia:'TER',horas:['08:00 - 12:00','14:00 - 18:30']},{dia:'SÁB',horas:['08:00 - 12:00']},{dia:'DOM',horas:['Fechado']}]);
const status=(rows,when)=>hoursStatus(rows,at(when));

test('horário do acervo vira linhas por dia (24h, fechado, dois intervalos)',()=>{
 assert.deepEqual(comercial,[{weekday:1,opens:'08:00',closes:'18:00'},{weekday:2,opens:'08:00',closes:'12:00'},{weekday:2,opens:'14:00',closes:'18:30'},{weekday:6,opens:'08:00',closes:'12:00'}]);
 assert.deepEqual(parseAcervoHours([{dia:'QUA',horas:['Aberto 24h']},{dia:'XYZ',horas:['08:00 - 10:00']},{dia:'QUI',horas:['texto']}]),[{weekday:3,opens:'00:00',closes:'24:00'}]);
 assert.deepEqual(weekLabels(comercial,2).map(d=>`${d.day}: ${d.label}${d.today?' (hoje)':''}`),['segunda-feira: 8h às 18h','terça-feira: 8h às 12h e 14h às 18h30 (hoje)','quarta-feira: Fechado','quinta-feira: Fechado','sexta-feira: Fechado','sábado: 8h às 12h','domingo: Fechado']);
 assert.deepEqual(weekLabels([]),[]);
});

test('aberto agora, fecha às e abre às, inclusive no intervalo do almoço e no fim de semana',()=>{
 assert.deepEqual(status(comercial,'2026-10-05T10:00:00-03:00'),{openNow:true,closesAt:'18h',opensAt:'',opensDay:'',holiday:''});
 assert.deepEqual(status(comercial,'2026-10-05T07:59:00-03:00'),{openNow:false,closesAt:'',opensAt:'8h',opensDay:'hoje',holiday:''});
 assert.deepEqual(status(comercial,'2026-10-05T18:00:00-03:00'),{openNow:false,closesAt:'',opensAt:'8h',opensDay:'amanhã',holiday:''},'às 18h já fechou');
 assert.deepEqual(status(comercial,'2026-10-06T12:30:00-03:00'),{openNow:false,closesAt:'',opensAt:'14h',opensDay:'hoje',holiday:''});
 assert.equal(status(comercial,'2026-10-06T16:00:00-03:00').closesAt,'18h30');
 assert.deepEqual(status(comercial,'2026-10-10T13:00:00-03:00'),{openNow:false,closesAt:'',opensAt:'8h',opensDay:'segunda-feira',holiday:''});
 assert.deepEqual(status(comercial,'2026-10-05T13:00:00Z'),status(comercial,'2026-10-05T10:00:00-03:00'),'o relógio do servidor em UTC não muda nada');
});

test('aberto 24h, horário que passa da meia-noite e empresa sem horário',()=>{
 const h24=parseAcervoHours(['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].map(dia=>({dia,horas:['Aberto 24h']})));
 assert.deepEqual(status(h24,'2026-10-05T03:00:00-03:00'),{openNow:true,closesAt:'',opensAt:'',opensDay:'',holiday:''});
 const noite=parseAcervoHours([{dia:'SEX',horas:['18:00 - 02:00']},{dia:'SÁB',horas:['18:00 - 00:00']}]);
 assert.deepEqual(status(noite,'2026-10-10T01:00:00-03:00'),{openNow:true,closesAt:'2h',opensAt:'',opensDay:'',holiday:''},'sábado à 1h ainda vale a sexta');
 assert.deepEqual(status(noite,'2026-10-10T03:00:00-03:00'),{openNow:false,closesAt:'',opensAt:'18h',opensDay:'hoje',holiday:''});
 assert.equal(status(noite,'2026-10-10T23:00:00-03:00').closesAt,'0h');
 assert.deepEqual(status([],'2026-10-05T10:00:00-03:00'),{openNow:null,closesAt:'',opensAt:'',opensDay:'',holiday:''});
 const quarta=parseAcervoHours([{dia:'QUA',horas:['09:00 - 10:00']}]);
 assert.deepEqual(status(quarta,'2026-10-07T11:00:00-03:00'),{openNow:false,closesAt:'',opensAt:'9h',opensDay:'quarta-feira',holiday:''},'abre de novo só na semana que vem');
});

test('feriados nacionais deixam o status em aberto ("consulte")',()=>{
 for(const [date,name] of [['2026-01-01','Confraternização Universal'],['2026-04-03','Sexta-feira da Paixão'],['2026-04-21','Tiradentes'],['2026-11-20','Dia Nacional de Zumbi e da Consciência Negra'],['2027-03-26','Sexta-feira da Paixão'],['2026-12-25','Natal']])assert.equal(nationalHoliday(date),name,date);
 assert.equal(nationalHoliday('2026-02-17'),'','Carnaval é ponto facultativo');assert.equal(nationalHoliday('2026-10-05'),'');
 assert.deepEqual(status(comercial,'2026-12-25T10:00:00-03:00'),{openNow:null,closesAt:'',opensAt:'',opensDay:'',holiday:'Natal'});
 assert.deepEqual(localNow(at('2026-10-06T02:30:00Z')),{date:'2026-10-05',weekday:1,minute:23*60+30});
});

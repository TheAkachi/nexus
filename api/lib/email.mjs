// Envio de e-mail pelo Brevo (decisão de 03/10/2026). Só funciona com BREVO_API_KEY e MAIL_FROM no .env da VPS; sem eles,
// devolve null e quem convida recebe o link para mandar pelo WhatsApp (contrato 12.2).
export function brevoMailer({apiKey=process.env.BREVO_API_KEY,from=process.env.MAIL_FROM,fetchImpl=globalThis.fetch}={}) {
  if(!apiKey||!from)return null;
  return async({to,subject,text})=>{
    try {
      const r=await fetchImpl('https://api.brevo.com/v3/smtp/email',{method:'POST',signal:AbortSignal.timeout(10000),
        headers:{'api-key':apiKey,'content-type':'application/json',accept:'application/json'},
        body:JSON.stringify({sender:{email:from,name:'Nexus'},to:[{email:to}],subject,textContent:text})});
      return r.ok;
    } catch {return false;}
  };
}
// O começo do convite serve ao e-mail e, sem o e-mail, à mensagem do WhatsApp da empresa (contrato 21.3, provisória [P1]).
export const textoConviteWhatsapp=({empresa,papel,link,validade})=>`Olá!\n\nVocê foi convidado para cuidar da empresa ${empresa} no Nexus, com o papel "${papel}".\n\nPara criar sua senha e entrar, abra o link abaixo (vale até ${validade}):\n${link}`;
export const textoConvite=x=>`${textoConviteWhatsapp(x)}\n\nSe você não esperava este convite, ignore este e-mail.\n\nNexus`;
export const textoRecuperacao=({link})=>`Olá!\n\nRecebemos um pedido para criar uma nova senha no Nexus.\n\nAbra o link abaixo em até 1 hora:\n${link}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.\n\nNexus`;

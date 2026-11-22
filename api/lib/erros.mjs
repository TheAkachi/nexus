// Erro de validação com status HTTP. As rotas antigas (/api/events) devolvem {error: mensagem}; as APIs da Fase 3 em
// diante devolvem {erro, campo?} (contrato 12.2), com campo igual ao nome do campo recusado.
// v0.22.0: extra leva dados para a resposta, como o nome igual ou os parecidos (contrato 22.7).
export const fail=(message,status=422,campo,extra)=>Object.assign(new Error(message),{status,...(campo?{campo}:{}),...(extra?{extra}:{})});

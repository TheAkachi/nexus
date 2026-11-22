// Banners publicados dentro da janela de exibição, com as categorias da empresa anunciante (regra do concorrente no perfil).
// Empresa para a regra do anúncio (11.3, regra 6) fora do perfil, como na página do cupom (16.2): categorias e se é pagante.
// Pagante: plano real ativo e pago; enquanto nenhuma empresa publicada tem plano real, quem tinha página própria no portal.
export async function empresaAnunciante(db,id) {
  const r=(await db.query(`SELECT b.id,b.details->'categories' AS categories,b.own_page,p.id AS plan_id,p.paid AS plan_paid,
    EXISTS(SELECT 1 FROM businesses x JOIN plans q ON q.id=x.plan_id AND q.status='active' WHERE x.status='published') AS algum
    FROM businesses b LEFT JOIN plans p ON p.id=b.plan_id AND p.status='active' WHERE b.id=$1`,[id])).rows[0];
  return r?{id:r.id,categories:r.categories||[],pagante:r.algum?Boolean(r.plan_id&&r.plan_paid):r.own_page===true}:null;
}
export async function activeCampaigns(db,now=new Date()) {
  return (await db.query(`SELECT c.*,COALESCE(b.details->'categories','[]'::jsonb) AS business_categories FROM campaigns c LEFT JOIN businesses b ON b.id=c.business_id
    WHERE c.status='published' AND (c.starts_at IS NULL OR c.starts_at<=$1) AND (c.ends_at IS NULL OR c.ends_at>$1) ORDER BY c.id`,[now.toISOString()])).rows;
}

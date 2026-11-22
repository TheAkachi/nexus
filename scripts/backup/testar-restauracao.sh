#!/bin/sh
# Teste de restauração: restaura um backup (o mais recente, ou o arquivo passado) num PostgreSQL 17 descartável, com a
# imagem atual do app, e mostra as contagens por tabela. Não toca no banco da homologação. Procedimento em docs/OPERACAO.md.
set -eu
. /etc/primig-p3-backup.env
export BACKUP_PASSPHRASE
dir=${BACKUP_DIR:-/var/backups/primig-p3}
file=${1:-$(ls -1t "$dir"/primig-*.json | head -1)}
name=primig-restauracao-$$
image=$(docker inspect primig-p3-app-1 --format '{{.Config.Image}}')
cleanup() { docker rm -f "$name-db" >/dev/null 2>&1 || true; docker network rm "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker network create "$name" >/dev/null
docker run -d --name "$name-db" --network "$name" -e POSTGRES_PASSWORD=restauracao -e POSTGRES_DB=restauracao postgres:17-alpine >/dev/null
# pg_isready por TCP só responde depois da inicialização completa do banco.
i=0; until docker exec "$name-db" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; do i=$((i+1)); [ "$i" -lt 60 ] || exit 1; sleep 1; done
echo "Restaurando $file"
# O arquivo vai pela entrada padrão: continua só do root na VPS (o contêiner roda como o usuário node).
docker run --rm -i --network "$name" -e NODE_ENV=production -e BACKUP_PASSPHRASE \
  -e DATABASE_URL="postgresql://postgres:restauracao@$name-db:5432/restauracao" "$image" node api/cli.mjs restore /dev/stdin < "$file"
# Fotos do painel: o arquivo do mesmo backup (mesmo carimbo de data) tem de abrir com a senha e listar os arquivos.
media=$(echo "$file" | sed 's/primig-\([0-9TZ]*\)\.json$/primig-midia-\1.tar.gz.enc/')
if [ -f "$media" ]; then
  n=$(openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$media" | tar -tzf - | grep -c '\.webp$' || true)
  echo "Fotos: $media abre e tem $n arquivos WebP"
else
  echo "Fotos: sem arquivo de mídia para este backup"
fi

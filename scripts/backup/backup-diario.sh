#!/bin/sh
# Backup diário do PRIMIG P3 na VPS (primig-p3-backup.timer, 03:30). Procedimento em docs/OPERACAO.md.
# 1. O app gera o backup criptografado do banco (AES-256-GCM, sem hash de senha) e o arquivo fica na VPS, fora do contêiner.
# 2. As fotos do painel (volume de mídia, /app/media) viram um tar.gz criptografado com a mesma senha (AES-256, PBKDF2).
# 3. Apaga da VPS os backups com mais de KEEP_DAYS dias.
# 4. Com RCLONE_REMOTE definido, envia uma cópia para fora da VPS e apaga lá as cópias com mais de REMOTE_KEEP_DAYS dias.
# Configuração em /etc/primig-p3-backup.env (root, 600): BACKUP_PASSPHRASE e, opcionais, BACKUP_DIR, KEEP_DAYS,
# RCLONE_REMOTE e REMOTE_KEEP_DAYS. Modelo em scripts/backup/backup.env.exemplo.
set -eu
. /etc/primig-p3-backup.env
export BACKUP_PASSPHRASE
compose="docker compose -f /docker/primig-p3/docker-compose.yml"
dir=${BACKUP_DIR:-/var/backups/primig-p3}
mkdir -p "$dir" && chmod 700 "$dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
file="$dir/primig-$stamp.json"
$compose exec -T -e BACKUP_PASSPHRASE app node api/cli.mjs backup --stdout > "$file.parcial"
# Arquivo vazio ou truncado não substitui nada: só entra com o nome final se for JSON do formato esperado.
grep -q '"algorithm":"aes-256-gcm"' "$file.parcial" || { rm -f "$file.parcial"; echo "Backup inválido" >&2; exit 1; }
mv "$file.parcial" "$file" && chmod 600 "$file"
enviar="$file"
# Fotos: só quando o volume de mídia existe. O tar sai do contêiner, é criptografado e conferido (abre e lista) antes de valer.
if $compose exec -T app test -d /app/media; then
  media="$dir/primig-midia-$stamp.tar.gz.enc"
  plano="$dir/.midia-$stamp.tar.gz"
  trap 'rm -f "$plano" "$media.parcial"' EXIT
  $compose exec -T app tar -C /app/media -czf - . > "$plano"
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -in "$plano" -out "$media.parcial"
  rm -f "$plano"
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$media.parcial" | tar -tzf - > /dev/null \
    || { echo "Backup das fotos inválido" >&2; exit 1; }
  mv "$media.parcial" "$media" && chmod 600 "$media"
  enviar="$enviar $media"
fi
find "$dir" \( -name 'primig-*.json' -o -name 'primig-midia-*.tar.gz.enc' \) -mtime +"${KEEP_DAYS:-30}" -delete
if [ -n "${RCLONE_REMOTE:-}" ]; then
  for f in $enviar; do rclone copy "$f" "$RCLONE_REMOTE"; done
  rclone delete --min-age "${REMOTE_KEEP_DAYS:-90}d" --include 'primig-*' "$RCLONE_REMOTE"
fi
for f in $enviar; do echo "Backup: $f ($(wc -c < "$f") bytes)"; done

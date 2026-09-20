# Processo de releases de mapas

## Convenção

Tags de mapas usam `br-maps-vYYYY.MM.PATCH`, por exemplo `br-maps-v2026.09.0`.

## Ciclo draft → validação → publicação

1. Gerar ou preparar os arquivos candidatos localmente ou em um agente Woodpecker.
2. Calcular tamanho em bytes e SHA-256 de cada `.pmtiles`.
3. Gerar `maps-manifest.json` a partir de metadados verificados.
4. Gerar `SHA256SUMS.txt` para os assets `.pmtiles` disponíveis.
5. Criar um GitHub Release como **draft** com o tag `br-maps-vYYYY.MM.PATCH`.
6. Anexar `.pmtiles`, `maps-manifest.json` e `SHA256SUMS.txt` ao draft.
7. Executar o workflow `Verify draft map release` informando o tag.
8. Se a validação falhar, manter o release como draft e substituir/corrigir os assets.
9. Publicar manualmente o release somente após a verificação ficar verde.
10. Consumidores ArtiSys descobrem somente o último release **publicado e não-prerelease**.

O P0 não publica releases automaticamente.

## Por que o workflow usa a API REST

Draft releases não são fonte pública. A API de listagem de releases retorna drafts somente para credenciais com acesso adequado ao repositório. Por isso o workflow de verificação localiza o draft autenticado pela API REST e baixa seus assets por ID antes da publicação.

## Conteúdo obrigatório

Um release publicável contém `maps-manifest.json`, `SHA256SUMS.txt` e zero ou mais `.pmtiles` declarados como `available: true`. No scaffolding P0 é válido não haver `.pmtiles`, porque todos os pacotes estão indisponíveis.

## Rollback

Nunca apagar o release publicado anterior ao publicar um novo. Se a nova versão apresentar problema, preservar os assets anteriores para diagnóstico e recuperação.

## Regra do consumidor

Branches, commits, pull requests, artifacts de Actions e releases draft/prerelease não são endpoints de produção para o Sistema Lavoura.

## P1 — primeiros pacotes reais

O P1 automatiza a geração de `brasil-base.pmtiles` (z0–7) e `sp.pmtiles` (z7–14) a partir de um build diário recente do Protomaps. O workflow resolve o build mais novo disponível nos últimos sete dias, extrai somente os recortes necessários via HTTP Range Requests, valida cada arquivo com o CLI PMTiles, gera metadados/manifesto/checksums e monta `br-maps-v2026.09.0` como **draft**.

Depois do upload, o workflow baixa novamente os assets do draft pela API do GitHub e repete a validação. O P1 nunca publica o release automaticamente e recusa sobrescrever um release já publicado com o mesmo tag.

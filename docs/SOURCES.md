# Fontes e proveniência

## Fonte-base

Os pacotes serão derivados de dados do OpenStreetMap obtidos por fonte de extratos que permita redistribuição compatível com a ODbL.

O P0 ainda não gera dados reais. A primeira geração real (`brasil-base.pmtiles` e `sp.pmtiles`) deverá registrar provedor do extrato, URL/documentação da fonte, timestamp/data do extrato, licença aplicável, ferramenta e versão de transformação, parâmetros de zoom/filtragem e comandos reproduzíveis usados na geração.

## Bounds do catálogo P0

Os `bounds` registrados em `catalog/states.json` são envelopes geográficos conservadores para descoberta, navegação e validação básica. Eles **não são limites cadastrais, jurídicos ou de levantamento**.

Na fase de geração real, os envelopes e extents devem ser conferidos contra a fonte utilizada e contra o pacote PMTiles produzido.

## OpenStreetMap

Os dados do OpenStreetMap são disponibilizados sob ODbL. Aplicações consumidoras devem aplicar a atribuição documentada em `NOTICE.md`.

Referência oficial:

https://www.openstreetmap.org/copyright

O projeto não implica endosso por OpenStreetMap, OpenStreetMap Foundation ou seus contribuidores.

## P1 — Protomaps Basemap daily build

A primeira geração real usa o Protomaps Basemap daily build como *Produced Work* baseado em OpenStreetMap. A geração não baixa o planet completo: o CLI PMTiles usa HTTP Range Requests para extrair os subarquivos definidos pelo catálogo.

- descoberta: o build diário mais recente disponível dentro dos últimos 7 dias UTC;
- URL-base: `https://build.protomaps.com/YYYYMMDD.pmtiles`;
- ferramenta: `pmtiles` CLI v1.31.2;
- `brasil-base`: bounds do catálogo, zoom 0–7;
- `sp`: bounds do catálogo, zoom 7–14;
- cada draft inclui `SOURCE_INFO.json` com URL, build/data, licença e versão da ferramenta.

Como a extração é baseada em tiles que intersectam o bounding box, tiles de zoom baixo podem conter contexto fora do limite administrativo. O pacote é um mapa-base de navegação, não um limite jurídico/cadastral.

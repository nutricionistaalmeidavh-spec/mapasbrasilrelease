# Fontes e proveniência

## Fonte-base

Os pacotes são distribuídos a partir de fontes abertas com proveniência registrada por release. O contrato v1 mantém OpenStreetMap como fonte primária que exige atribuição, enquanto `SOURCE_INFO.json` registra o provedor de transformação/distribuição e avisos sobre fontes abertas adicionais quando aplicável.

O P0 não gerava dados reais. A partir do P1, cada geração real (`brasil-base.pmtiles`, `sp.pmtiles` e futuros pacotes) registra provedor, URL/documentação da fonte, timestamp/data, obrigações de licença/atribuição, ferramenta e versão, parâmetros de zoom/filtragem e comandos reproduzíveis usados na geração.

## Bounds do catálogo P0

Os `bounds` registrados em `catalog/states.json` são envelopes geográficos conservadores para descoberta, navegação e validação básica. Eles **não são limites cadastrais, jurídicos ou de levantamento**.

Na fase de geração real, os envelopes e extents devem ser conferidos contra a fonte utilizada e contra o pacote PMTiles produzido.

## OpenStreetMap

O OpenStreetMap é a principal fonte de dados do basemap utilizado neste projeto e é disponibilizado sob ODbL. Aplicações consumidoras devem manter a atribuição aplicável documentada em `NOTICE.md`.

Referência oficial:

https://www.openstreetmap.org/copyright

O projeto não implica endosso por OpenStreetMap, OpenStreetMap Foundation ou seus contribuidores.

## P1 — Protomaps Basemap daily build

A primeira geração real usa o Protomaps Basemap daily build. O Protomaps Basemap é construído principalmente a partir de OpenStreetMap e também pode incorporar outras fontes de dados abertas; por isso, `SOURCE_INFO.json` registra o Protomaps como provedor do basemap, OpenStreetMap como fonte primária, a existência de fontes abertas adicionais e referências para os avisos/licenças aplicáveis.

A geração não baixa o planet completo: o CLI PMTiles usa HTTP Range Requests para extrair os subarquivos definidos pelo catálogo.

- descoberta: o build diário mais recente disponível dentro dos últimos 7 dias UTC;
- URL-base: `https://build.protomaps.com/YYYYMMDD.pmtiles`;
- ferramenta: `pmtiles` CLI v1.31.2;
- `brasil-base`: bounds do catálogo, zoom 0–7;
- `sp`: bounds do catálogo, zoom 7–14;
- cada draft inclui `SOURCE_INFO.json` com URL, build/data, versão da ferramenta e referências de atribuição/proveniência;
- referência de termos/proveniência do provedor: `https://protomaps.com/legal`.

Como a extração é baseada em tiles que intersectam o bounding box, tiles de zoom baixo podem conter contexto fora do limite administrativo. O pacote é um mapa-base de navegação, não um limite jurídico/cadastral.

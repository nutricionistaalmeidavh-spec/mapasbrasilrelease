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

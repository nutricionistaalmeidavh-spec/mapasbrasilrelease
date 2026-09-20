# P2 — Geração completa dos mapas do Brasil

Data da execução real: 2026-09-20

## Escopo entregue

O P2 generaliza o pipeline validado no P1 para os 28 pacotes do catálogo:

- `brasil-base.pmtiles` em zoom 0–7;
- 26 estados + Distrito Federal em zoom 7–14;
- geração por matrix GitHub Actions com no máximo 4 extrações paralelas;
- uma única fonte diária fixada para toda a release;
- `pmtiles verify` em cada pacote antes do upload;
- manifesto final fail-closed com os 28 pacotes disponíveis;
- verificação do tamanho e do SHA-256 pelo índice de assets do próprio GitHub Release;
- remoção dos metadados temporários antes da homologação;
- nenhuma inclusão de `.pmtiles` no histórico Git.

## Fonte

- Provedor: Protomaps Basemap daily build
- Build: `20260920`
- Data: `2026-09-20`
- URL-base usada na geração: `https://build.protomaps.com/20260920.pmtiles`
- Fonte primária: OpenStreetMap, ODbL 1.0
- O Protomaps também incorpora outras fontes abertas, registradas por referência legal em `SOURCE_INFO.json`.
- CLI: PMTiles/go-pmtiles v1.31.2, com binário Linux previamente validado por SHA-256.

## Resultado medido

| Métrica | Resultado |
| --- | ---: |
| Pacotes PMTiles | 28 |
| Assets finais do draft | 31 |
| Tamanho agregado dos 28 PMTiles | 3.958.207.036 bytes (~3,69 GiB) |
| Maior pacote | `mg.pmtiles` |
| Tamanho de Minas Gerais | 760.795.560 bytes (~725,55 MiB) |

Os 31 assets finais correspondem a:

- 28 arquivos `.pmtiles`;
- `maps-manifest.json`;
- `SHA256SUMS.txt`;
- `SOURCE_INFO.json`.

## Release draft

- Versão: `2026.09.1`
- Tag pretendida: `br-maps-v2026.09.1`
- Release ID: `392491423`
- Estado: **draft**
- Publicação solicitada na execução de homologação: **não**

Enquanto uma release ainda é draft, a API do GitHub pode expor `tag_name` como `untagged-*`. Por isso o P2 seleciona um draft reutilizável pelo tag pretendido **ou** pelo nome determinístico `Mapas Brasil <versão>`, recusando ambiguidade e nunca reutilizando uma release já publicada.

## Evidência da execução real

Workflow: `P2 generate all Brazil map packages`

Run: `35522240042`

Conclusão: **success**.

A execução confirmou:

1. validação do repositório antes da geração;
2. matrix com exatamente 28 pacotes;
3. uma única fonte Protomaps para toda a versão;
4. 28 extrações reais por HTTP Range Requests;
5. `pmtiles verify` em cada recorte;
6. limite de segurança por asset inferior a 2 GiB;
7. 28 metadados temporários recebidos no assembler;
8. manifesto com 28 pacotes disponíveis;
9. correspondência de tamanho e SHA-256 dos 28 PMTiles com os digests reportados pelo GitHub Release;
10. remoção dos 28 metadados temporários;
11. verificação final de exatamente 31 assets;
12. publicação automaticamente bloqueada porque `publish=false`.

No job `assemble`, a suíte disponível naquele commit registrou 47/47 testes aprovados, além de `npm run validate`. A correção posterior de idempotência do draft foi desenvolvida em ciclo RED→GREEN e passa também pelo CI normal do PR.

## Rollback e publicação

O workflow preserva a última release publicada como referência de rollback e nunca a sobrescreve. Como ainda não havia uma release publicada durante esta primeira geração completa, `previousPublishedRelease` ficou `null`.

A geração pesada é executada somente por `workflow_dispatch`. Para publicar, a execução precisa ocorrer a partir de `main`, com `publish=true`, e somente depois de todos os gates dos 28 pacotes terem passado.

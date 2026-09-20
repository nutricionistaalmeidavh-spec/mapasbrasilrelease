# P1 — Resultado da primeira geração real

Data da execução: 2026-09-20

## Fonte

- Provedor de basemap: Protomaps Basemap daily build
- Build: `20260920`
- URL-fonte: `https://build.protomaps.com/20260920.pmtiles`
- Fonte primária de dados: OpenStreetMap
- Outras fontes abertas: podem ser incorporadas pelo Protomaps Basemap; detalhes/avisos devem seguir `https://protomaps.com/legal`
- CLI: `go-pmtiles` / `pmtiles` v1.31.2
- Binário Linux x86_64 verificado antes da execução por SHA-256 `3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f`

## Pacotes gerados

| Pacote | Zoom | Tamanho | SHA-256 |
| --- | --- | ---: | --- |
| `brasil-base.pmtiles` | 0–7 | 8.221.529 bytes | `9de2d48dcdf816c78aa1276a9c887faf6a3efedd4b4ceaf44262580d678956c3` |
| `sp.pmtiles` | 7–14 | 454.144.673 bytes | `d56d31606fb29e9245121cb4e24d7c4b8e15eb1b826f8e09d968cb79d3c5ebca` |

Os arquivos foram validados com `pmtiles verify`, depois pelo verificador do repositório (tamanho + SHA-256 + manifesto) e novamente após upload/download do GitHub Release draft.

## Release draft

- Tag planejado: `br-maps-v2026.09.0`
- Release ID: `392482014`
- Estado: **draft**
- Publicação automática: **desabilitada**
- Assets presentes:
  - `brasil-base.pmtiles`
  - `sp.pmtiles`
  - `maps-manifest.json`
  - `SHA256SUMS.txt`
  - `SOURCE_INFO.json`

`SOURCE_INFO.json` é o registro de proveniência detalhado do release: identifica o Protomaps como provedor do basemap, OpenStreetMap como fonte primária, informa que o basemap pode conter outras fontes abertas e aponta para as páginas de atribuição/licenciamento aplicáveis.

## Evidência CI

Workflow: `P1 generate real map packages`

Run validado inicialmente: `35520505858`

O run concluiu com sucesso incluindo:

1. `npm ci`;
2. suíte Node completa (40 testes);
3. validação do manifesto P0;
4. verificação do binário PMTiles oficial por SHA-256;
5. descoberta do build diário recente;
6. extração dos dois PMTiles por HTTP Range Requests;
7. `pmtiles verify` em ambos;
8. geração de metadados, manifesto e checksums;
9. verificação local do staging;
10. upload para release draft;
11. download de todos os assets do draft;
12. nova validação do manifesto/tamanho/SHA-256 após o round-trip.

## Observação de tamanho

O teste real confirma a estratégia de não incluir o estado detalhado no instalador principal: o Brasil-base ficou pequeno (~7,84 MiB), enquanto São Paulo em zoom 7–14 ficou ~433 MiB. O modelo de Brasil-base no instalador + estados sob demanda continua adequado.

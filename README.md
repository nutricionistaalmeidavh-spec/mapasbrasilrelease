# ArtiSys Mapas Brasil Release

Repositório público de distribuição dos mapas offline usados pelo ArtiSys Lavoura e por futuros produtos ArtiSys compatíveis com o mesmo contrato.

## Objetivo

O projeto mantém um catálogo versionado de `brasil-base`, dos 26 estados e do Distrito Federal. Os arquivos de mapa serão distribuídos como assets `.pmtiles` em GitHub Releases, sem servidor ArtiSys, API paga, conta do cliente ou dependência de Google Maps.

O P0 contém apenas a infraestrutura de catálogo, manifesto, integridade, validação e release. **Nenhum PMTiles real é publicado nesta fase.**

## O que fica no Git

- catálogo geográfico;
- schema e manifesto;
- scripts de validação, checksum e verificação de release;
- testes;
- documentação e CI.

Arquivos grandes como `.pmtiles`, `.osm.pbf` e `.mbtiles` são bloqueados pelo `.gitignore` e pertencem somente a GitHub Releases ou áreas locais de build.

## Requisitos

- Node.js 22.x
- npm 10+

Não há dependências npm de runtime ou desenvolvimento no P0.

## Comandos

```bash
npm install
npm test
npm run validate
```

Gerar um manifesto a partir de metadados verificados:

```bash
npm run manifest:build -- \
  --metadata catalog/build-metadata.json \
  --output ./tmp/maps-manifest.json \
  --release-version 2026.09.0 \
  --generated-at 2026-09-20T00:00:00Z
```

Calcular SHA-256:

```bash
npm run checksum -- caminho/arquivo.pmtiles
```

Verificar uma pasta preparada para release:

```bash
npm run release:verify -- \
  --manifest catalog/maps-manifest.json \
  --assets release-staging
```

## Contrato do consumidor

O aplicativo consumidor descobre apenas o **último Release publicado e não-prerelease**. Drafts, branches e arquivos de trabalho nunca são fonte de produção.

Após obter o manifesto do último release, o aplicativo usa `releaseVersion` para fixar o download dos assets no tag `br-maps-vYYYY.MM.PATCH`, verifica tamanho e SHA-256 e só então instala o arquivo localmente.

## Documentação

- [Formato do catálogo e manifesto](docs/FORMAT.md)
- [Processo de releases](docs/RELEASES.md)
- [Fontes e proveniência](docs/SOURCES.md)
- [Licença dos dados](LICENSE-DATA.md)
- [Atribuição](NOTICE.md)

## Infraestrutura

O desenho obrigatório do projeto é de custo de infraestrutura **R$ 0** para a ArtiSys: GitHub armazena o código e distribui os assets de Release, enquanto a geração pesada pode acontecer em máquina local ou agente Woodpecker.

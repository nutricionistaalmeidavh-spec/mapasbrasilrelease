# Formato dos mapas e do manifesto

## Pacotes suportados

O schema v1 conhece exatamente 28 IDs:

```text
brasil-base
ac al ap am ba ce df es go ma mt ms mg pa pb pr pe pi rj rn rs ro rr sc sp se to
```

`brasil-base` representa o mapa nacional de baixa resolução. Os demais IDs representam as 26 unidades estaduais e o Distrito Federal.

## Manifesto v1

`maps-manifest.json` possui as chaves de topo:

- `schemaVersion`: versão inteira do contrato; P0 aceita somente `1`;
- `releaseVersion`: `YYYY.MM.PATCH`;
- `generatedAt`: timestamp UTC ISO-8601;
- `source`: fonte primária e licença-base que exigem atribuição no contrato v1;
- `maps`: lista ordenada dos 28 pacotes.

No schema v1, `source` permanece `OpenStreetMap` / `ODbL-1.0` como referência primária de dados e atribuição. Quando o arquivo distribuído é um *Produced Work* preparado por outro provedor ou incorpora fontes abertas adicionais, a proveniência completa do release fica em `SOURCE_INFO.json`; o campo compacto `source` não deve ser interpretado como uma lista exaustiva de todas as fontes do basemap.

Cada entrada de `maps` contém `id`, `name`, `kind`, `available`, `version`, `asset`, `size`, `sha256`, `minZoom`, `maxZoom`, `bounds` e `sourceDate`.

## Nullability

Quando `available` é `false`, `version`, `asset`, `size`, `sha256` e `sourceDate` devem ser `null`.

Quando `available` é `true`, todos devem estar preenchidos e válidos. Um arquivo existente em disco, isoladamente, **não** torna um pacote disponível.

## Nomes de assets

Os nomes são determinísticos: `brasil-base.pmtiles` para o pacote nacional e `<uf>.pmtiles` para estados/DF. Não são permitidos caminhos, barras ou `..` em `asset`.

## Integridade

Um pacote disponível declara tamanho exato em bytes e SHA-256 de 64 caracteres hexadecimais minúsculos. O consumidor verifica ambos antes de mover o download temporário para o diretório definitivo de mapas.

## Resolução de URL

O consumidor pode descobrir o manifesto pelo alias do último release publicado:

```text
https://github.com/nutricionistaalmeidavh-spec/mapasbrasilrelease/releases/latest/download/maps-manifest.json
```

Depois de ler `releaseVersion`, deve fixar os downloads no tag daquela versão:

```text
https://github.com/nutricionistaalmeidavh-spec/mapasbrasilrelease/releases/download/br-maps-v<releaseVersion>/<asset>
```

Isso evita misturar manifesto de uma versão com asset de outra caso uma nova release seja publicada durante o download.

## Schema futuro

Se um consumidor receber `schemaVersion` desconhecido, deve falhar fechado: não deve adivinhar campos nem instalar assets. A UX deve orientar atualização do aplicativo consumidor.

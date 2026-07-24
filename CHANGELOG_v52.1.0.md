# LifeOS Enterprise v52.1.0 — Correção de Documentos e Fotos

**Data:** 24 de julho de 2026

**Tipo:** Release de manutenção

**Escopo:** Operação Go Live Comercial — Documentos, Fotos, upload, download, pastas e persistência.

## Correções entregues

| Área | Correção | Resultado |
|---|---|---|
| Carregamento de módulos | O painel passou a solicitar a rota canônica dos módulos, eliminando o redirecionamento que interrompia a abertura de Fotos e Documentos. | Os dois módulos carregam sem erro de navegação. |
| Documentos | Pastas agora são criadas no KV, exibidas por ID persistente e excluídas sem deixar arquivos filhos inacessíveis. | Criação, movimentação, exclusão e recuperação de itens persistem. |
| Documentos | Compartilhamento passou a autorizar o destinatário a acessar download e conteúdo do objeto armazenado no R2. | Compartilhamento deixa de ser apenas metadado visual. |
| Documentos | A cópia cria um objeto independente no R2 e seu próprio histórico de versões. | A cópia permanece disponível após exclusão do original. |
| Documentos | Edição de documentos de texto gera nova versão no R2, com tamanho, metadados e auditoria atualizados. | Edição e versionamento funcionam de forma persistente. |
| Fotos | Foram corrigidos o fluxo de álbum, os modais, a busca por metadados, a edição, a movimentação e a exclusão. | Upload, preview, miniaturas visuais, álbuns e CRUD estão operacionais. |
| Fotos | Upload passou a validar extensão e tipo, e as respostas de validação retornam status apropriado. | Arquivos de imagem não permitidos são bloqueados de forma previsível. |
| Estabilidade | O módulo Enterprise não lança mais erro global quando seu contêiner não está presente na tela atual. | Navegação dos módulos permanece livre de exceções observadas. |

## Validação executada localmente

| Teste | Cobertura | Resultado |
|---|---|---|
| `npm run build` | Geração do artefato Cloudflare Pages | Aprovado |
| `qa-document-workflows.mjs` | Criação, upload, download, edição, versões, pasta, cópia, compartilhamento, favoritos, lixeira, restauração e exclusão | Aprovado |
| `qa-photo-workflows.mjs` | Upload, conteúdo, miniatura, álbum, busca, edição, favorito, movimentação e exclusão | Aprovado |
| `qa-persistence-local.mjs` | Persistência de Documento e Foto após reinício do ambiente local | Aprovado |
| `qa-documents-photos-local.mjs` | Navegação, refresh, nova sessão e visualizador | Aprovado |
| `qa-documents-photos-crud-ui.mjs` | CRUD visual de Documentos e Fotos em navegador automatizado | Aprovado |

> Esta versão foi validada em ambiente local isolado com KV e R2 locais. A publicação e a verificação final em produção dependem da ativação da integração Cloudflare e do deploy do commit desta release.

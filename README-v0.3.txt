DEFESA VEGETAL AM — PWA v0.3

NOVIDADES
- URL /exec e API_TOKEN são informados na tela Configuração; não ficam gravados no código-fonte.
- Sincronização baixa Propriedade + Cadastro_Pragas para IndexedDB.
- Dashboard mostra online/offline, propriedades, pragas, pendências e última atualização.
- Fiscalização usa a lista de pragas baixada da planilha e mostra legislação automaticamente.
- Corrigido envio de foto para o formato data URL esperado pelo backend v0.3.

PRIMEIRO TESTE
1. Sirva esta pasta por HTTPS (ou localhost). Não abra apenas via file://, pois Service Worker/PWA exige contexto seguro.
2. Abra o app > Configuração.
3. Cole a URL do Apps Script terminada em /exec e o API_TOKEN.
4. Clique Salvar configuração e depois Testar conexão.
5. Volte ao Início e clique Sincronizar.
6. Confirme no painel as quantidades de propriedades e pragas.
7. Com a página já carregada, desligue a internet e recarregue o app. Os cadastros devem continuar disponíveis.

IMPORTANTE
- O token em localStorage é adequado para MVP interno, mas não é autenticação multiusuário de produção.
- Não publique o token em repositório público.
- O backend Apps Script v0.3 já implantado deve continuar sendo usado.

DEFESA VEGETAL AM — MVP v0.2 (OFFLINE + SINCRONIZAÇÃO)

O app salva primeiro no IndexedDB do aparelho. O Google Apps Script só é usado quando houver internet.

CONFIGURAÇÃO DO BACKEND
1. Faça uma CÓPIA da sua planilha de produção para os primeiros testes.
2. Abra a planilha central no Google Sheets.
3. Extensões > Apps Script.
4. Substitua o conteúdo por Code.gs deste pacote.
5. No Apps Script: Configurações do projeto > Propriedades do script.
6. Crie API_TOKEN com uma chave longa e secreta.
7. Opcional: crie DRIVE_FOLDER_ID com o ID de uma pasta do Drive para as fotos.
8. Execute a função setup() uma vez e conceda as permissões.
9. Implantar > Nova implantação > Aplicativo da Web.
10. Execute como: você. Defina o acesso compatível com os aparelhos que usarão o sistema.
11. Copie a URL final que termina em /exec.

CONFIGURAÇÃO DO APP
12. Abra config.js.
13. Cole a URL /exec em API_URL.
14. Em API_TOKEN, coloque EXATAMENTE a mesma chave cadastrada no Apps Script.
15. Hospede os arquivos por HTTPS (PWA/Service Worker e geolocalização exigem contexto seguro; localhost serve para desenvolvimento).
16. Abra o app uma vez com internet para armazenar os arquivos essenciais no cache.
17. Faça um teste offline: desligue a internet, crie uma propriedade e uma fiscalização; religue e pressione Sincronizar.

SEGURANÇA/TESTE
- Não publique o API_TOKEN em um repositório público.
- Este MVP usa um token compartilhado; antes de uso institucional multiusuário, implementar autenticação individual e perfis.
- A sincronização faz UPSERT por UUID: repetir o envio atualiza o mesmo registro em vez de criar duplicata.
- O item só sai da fila local depois de confirmação positiva do servidor.
- Faça os primeiros testes em uma cópia da base real.

ARQUIVOS
index.html          interface
style.css           visual
manifest.json       instalação PWA
service-worker.js   cache/offline
config.js           URL/token do backend
db.js               IndexedDB
app.js              regras + sincronização
Code.gs             backend Apps Script

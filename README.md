# Gelado da Casa — Backend com banco de dados

API Node.js + Express com PostgreSQL para salvar pedidos de forma persistente.

## Arquivos

- `server.js`: API, criação automática da tabela e rotas.
- `package.json`: dependências e comando de inicialização.
- `.env.example`: exemplo das variáveis necessárias (não use credenciais reais neste arquivo).

## Variáveis de ambiente obrigatórias

- `DATABASE_URL`: string de conexão do PostgreSQL.
- `ADMIN_TOKEN`: token secreto para proteger a rota de consulta administrativa.
- `PGSSL`: opcional; defina `true` se o provedor exigir SSL.

## Rotas

- `GET /`: informações da API.
- `GET /api/health`: verifica a API e a conexão com o banco.
- `GET /api/products`: lista sabores e preços.
- `POST /api/orders`: valida e grava um pedido no PostgreSQL.
- `GET /api/admin/orders`: lista até 200 pedidos recentes; requer `Authorization: Bearer <ADMIN_TOKEN>`.

## Exemplo de pedido

Envie um POST para `/api/orders` com `Content-Type: application/json`:

```json
{
  "customerName": "Maria",
  "customerPhone": "11999999999",
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 9, "quantity": 1 }
  ]
}
```

O preço é calculado no servidor com base no catálogo, não no preço enviado pelo cliente.

## Publicar no Render

1. Crie um banco PostgreSQL no Render ou use um PostgreSQL compatível.
2. Copie a connection string privada/interna quando API e banco estiverem na mesma região.
3. Configure `DATABASE_URL` nas Environment Variables do Web Service.
4. Configure `ADMIN_TOKEN` com um segredo forte.
5. Configure `PGSSL` conforme as instruções do seu provedor.
6. Build Command: `npm install`; Start Command: `npm start`.

## Atenção

- Não publique `.env` nem credenciais no GitHub.
- Esta é uma base inicial. Antes de produção, implemente política de privacidade, retenção de dados, controles de abuso e proteção adicional conforme a operação.
- O endpoint de pedidos ainda não processa pagamento nem confirma entrega.

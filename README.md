# 🚀 Stokio - Gestão Inteligente de Estoque

![Stokio Dashboard](https://placehold.co/1200x600.png?text=Dashboard+do+Stokio)

**Stokio** é um sistema de Ponto de Venda (PDV) e gestão de estoque completo, construído para modernizar e otimizar a operação de varejo. Com uma interface intuitiva e recursos poderosos de inteligência artificial, o Stokio transforma dados brutos em insights acionáveis, ajudando você a gerenciar seu negócio de forma mais eficiente.

## ✨ Funcionalidades Principais

- **🏪 Frente de Caixa (PDV):** Um sistema de ponto de venda rápido e fácil de usar para registrar vendas, aceitar múltiplos pagamentos e gerenciar o carrinho de compras.
- **📦 Gestão de Produtos e Kits:** Cadastre produtos, organize-os por categorias e crie kits promocionais com regras de desconto flexíveis.
- **📊 Controle de Estoque:** Acompanhe a movimentação diária do seu estoque, receba alertas de estoque baixo e adicione novas entradas de produtos facilmente.
- **🤖 Assistente com IA (Oráculo AI):** Faça perguntas em linguagem natural sobre seu inventário e obtenha respostas instantâneas.
- **📈 Relatórios Gerenciais:** Visualize o desempenho de vendas por filial, identifique os produtos mais vendidos e analise o estoque baixo em um piscar de olhos.
- **🏢 Suporte a Múltiplas Filiais:** Gerencie o estoque, as vendas e os usuários de diferentes filiais a partir de uma única interface.
- **👥 Gestão de Usuários e Permissões:** Controle o acesso ao sistema com diferentes níveis de permissão (Admin, Gerente, Caixa).
- **⚙️ Configurações Flexíveis:** Personalize condições de pagamento, alíquotas de imposto por filial e muito mais.

## 🛠️ Tecnologias Utilizadas

Este projeto foi construído com uma stack moderna e robusta, focada em performance e escalabilidade:

- **Frontend:** [Next.js](https://nextjs.org/) (com App Router) e [React](https://react.dev/)
- **Backend & Banco de Dados:** [Firebase](https://firebase.google.com/) (Firestore, Authentication, App Check)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/) e [ShadCN UI](https://ui.shadcn.com/)
- **Inteligência Artificial:** [Google AI & Genkit](https://firebase.google.com/docs/genkit)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)

## 🚀 Como Começar

Para executar este projeto localmente, siga os passos abaixo:

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/seu-usuario/stokio.git
    cd stokio
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Configure as Variáveis de Ambiente:**
    Crie um arquivo chamado `.env` na raiz do projeto e adicione suas credenciais do Firebase. Você pode usar o arquivo `.env.example` como base.

    ```env
    # Firebase
    NEXT_PUBLIC_FIREBASE_API_KEY=SUA_CHAVE_DE_API
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=SEU_DOMINIO_DE_AUTENTICACAO
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=SEU_ID_DE_PROJETO
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=SEU_STORAGE_BUCKET
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=SEU_SENDER_ID
    NEXT_PUBLIC_FIREBASE_APP_ID=SEU_APP_ID

    # Firebase App Check (reCAPTCHA v3)
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY=SUA_CHAVE_DO_RECAPTCHA
    ```

4.  **Execute o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```

    A aplicação estará disponível em `http://localhost:9002`.

## ☁️ Hospedagem

A aplicação está configurada para ser hospedada no **Firebase App Hosting**. Para fazer o deploy, utilize o Firebase CLI:

```bash
# Inicialize o Firebase no projeto (apenas na primeira vez)
firebase init apphosting

# Faça o deploy para produção
firebase deploy
```

---

Desenvolvido no **Firebase Studio** ✨

# 💰 Controle Financeiro Familiar

Sistema completo de gestão financeira familiar com foco em cartões de crédito, desenvolvido com Next.js 15, TypeScript, Firebase e Tailwind CSS.

## 🚀 Funcionalidades

### ✅ Autenticação
- Login e registro com Firebase Authentication
- Proteção de rotas
- Gerenciamento de sessão

### 💳 Gestão de Cartões
- Cadastro de cartões de crédito
- Configuração de limite, dia de fechamento e vencimento
- Membros vinculados a cada cartão (Esposa, Marido, Filhos, etc.)
- Visualização de uso do limite em tempo real

### 💰 Controle de Despesas
- Cadastro de transações (Rendas, Contas Fixas, Variáveis)
- **Filtro inteligente**: ao selecionar um cartão, exibe apenas os membros vinculados
- **Cálculo automático de fatura**: baseado na data da compra e dia de fechamento
- Categorização de gastos

### 📊 Dashboard
- Resumo financeiro mensal
- Total de rendas, contas fixas e faturas
- Saldo do mês
- Barra de progresso de uso do limite por cartão
- Últimas transações

## 🛠️ Tecnologias

- **Framework**: Next.js 15 (App Router)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS
- **Componentes**: Shadcn/UI
- **Backend**: Firebase (Authentication + Firestore)
- **Validação**: Zod + React Hook Form
- **Ícones**: Lucide React
- **Datas**: date-fns

## 📁 Estrutura do Projeto

```
controle-financeiro/
├── app/                    # Rotas Next.js (App Router)
│   ├── layout.tsx         # Layout raiz com AuthProvider
│   ├── page.tsx           # Página inicial
│   ├── login/             # Página de login
│   ├── register/          # Página de registro
│   ├── dashboard/         # Dashboard financeiro
│   └── cards/             # Gestão de cartões
├── components/            # Componentes React
│   ├── Navbar.tsx        # Navegação responsiva
│   ├── NewExpenseForm.tsx # Formulário de despesas
│   └── ui/               # Componentes Shadcn/UI
├── context/              # Contextos React
│   └── AuthContext.tsx   # Contexto de autenticação
├── services/             # Lógica de negócio
│   └── financeService.ts # CRUD Firebase
├── lib/                  # Utilitários
│   ├── firebase.ts       # Configuração Firebase
│   ├── invoiceUtils.ts   # Cálculo de faturas
│   └── utils.ts          # Utilitários gerais
└── types/                # Interfaces TypeScript
    └── index.ts          # Tipos do domínio
```

## 🔧 Configuração

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Firebase

Crie um arquivo `.env.local` na raiz do projeto:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=sua_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=seu_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=seu_measurement_id
```

### 3. Configurar Firebase Console

**Habilitar Autenticação:**
1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Vá em "Authentication" → "Começar"
3. Habilite "Email/Password"

**Configurar Firestore:**
1. Vá em "Firestore Database" → "Criar banco de dados"
2. Configure as regras de segurança (veja abaixo)

### 4. Executar o Projeto

```bash
npm run dev
```

Acesse: http://localhost:3000

## 🔒 Regras de Segurança do Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /cards/{cardId} {
      allow read, write: if request.auth != null && 
                         request.auth.uid == resource.data.ownerId;
      
      match /users_assigned/{userId} {
        allow read, write: if request.auth != null;
      }
    }
    
    match /transactions/{transactionId} {
      allow read, write: if request.auth != null && 
                         request.auth.uid == resource.data.user_id_criador;
    }
  }
}
```

## 📊 Estrutura de Dados

### Collection: `cards`

```typescript
{
  id: string
  nome_cartao: string
  limite: number
  dia_fechamento: number (1-31)
  dia_vencimento: number (1-31)
  ownerId: string (userId)
  created_at: Timestamp
  updated_at: Timestamp
  
  // Subcollection: users_assigned
  users_assigned: [
    {
      id: string
      nome: string
      card_id: string
      created_at: Timestamp
    }
  ]
}
```

### Collection: `transactions`

```typescript
{
  id: string
  descricao: string
  valor: number
  categoria: Category
  data: Timestamp
  tipo: TransactionType
  metodo_pagamento: PaymentMethod
  card_id?: string
  user_id_gasto?: string
  mes_fatura?: string (YYYY-MM)
  user_id_criador: string
  created_at: Timestamp
  updated_at: Timestamp
}
```

## 🎯 Fluxo de Uso

1. **Criar conta** em `/register`
2. **Fazer login** em `/login`
3. **Cadastrar cartões** em `/cards`
4. **Adicionar membros** a cada cartão
5. **Registrar despesas** no Dashboard
6. **Acompanhar finanças** em tempo real

## 🚀 Próximas Funcionalidades

- [ ] Área de Faturas detalhada
- [ ] Gráficos e relatórios
- [ ] Exportação para Excel/PDF
- [ ] Notificações de vencimento
- [ ] Metas financeiras
- [ ] Categorias personalizadas

## 📝 Licença

Este projeto é de uso pessoal/familiar.

## 👨‍💻 Desenvolvido com

- Next.js
- TypeScript
- Firebase
- Tailwind CSS
- Shadcn/UI

---

**💰 Controle Financeiro Familiar** - Gerencie suas finanças de forma inteligente!

// ============================================
// ENUMS E TIPOS AUXILIARES
// ============================================

/**
 * Métodos de pagamento disponíveis
 */
export enum PaymentMethod {
    DINHEIRO_PIX = "DINHEIRO_PIX",
    CARTAO_CREDITO = "CARTAO_CREDITO",
}

/**
 * Tipos de transação
 */
export enum TransactionType {
    RENDA = "RENDA",
    CONTA_FIXA = "CONTA_FIXA",
    VARIAVEL = "VARIAVEL",
}

/**
 * Tipos de receita
 */
export enum IncomeType {
    FIXA = "FIXA",
    SAZONAL = "SAZONAL",
}

/**
 * Status de recebimento da receita
 */
export enum IncomeStatus {
    PENDENTE = "PENDENTE",
    RECEBIDO = "RECEBIDO",
}

/**
 * Tipos de conta bancária
 */
export enum AccountType {
    CORRENTE = "CORRENTE",
    POUPANCA = "POUPANCA",
    INVESTIMENTO = "INVESTIMENTO",
}

/**
 * Tipos de investimento
 */
export enum InvestmentType {
    ACOES = "ACOES",
    FUNDOS = "FUNDOS",
    RENDA_FIXA = "RENDA_FIXA",
    CRIPTOMOEDAS = "CRIPTOMOEDAS",
    OUTROS = "OUTROS",
}

/**
 * Papel do usuário na família
 */
export enum FamilyRole {
    OWNER = "OWNER",
    MEMBER = "MEMBER",
}

/**
 * Status do convite familiar
 */
export enum InvitationStatus {
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    EXPIRED = "EXPIRED",
}

/**
 * Categorias de transação
 */
export enum Category {
    // Rendas
    SALARIO = "SALARIO",
    FREELANCE = "FREELANCE",
    INVESTIMENTOS = "INVESTIMENTOS",
    OUTROS_RENDIMENTOS = "OUTROS_RENDIMENTOS",

    // Contas Fixas
    ALUGUEL = "ALUGUEL",
    ENERGIA = "ENERGIA",
    AGUA = "AGUA",
    INTERNET = "INTERNET",
    TELEFONE = "TELEFONE",
    CONDOMINIO = "CONDOMINIO",
    ASSINATURAS = "ASSINATURAS",

    // Variáveis
    ALIMENTACAO = "ALIMENTACAO",
    TRANSPORTE = "TRANSPORTE",
    SAUDE = "SAUDE",
    EDUCACAO = "EDUCACAO",
    LAZER = "LAZER",
    VESTUARIO = "VESTUARIO",
    OUTROS = "OUTROS",
}

// ============================================
// INTERFACES PRINCIPAIS
// ============================================

/**
 * Usuário vinculado a um cartão de crédito específico
 */
export interface CardUser {
    id: string;
    nome: string; // Ex: "Esposa", "Filho 1", "Marido"
    card_id: string; // Referência ao cartão ao qual este usuário pertence
    created_at: Date;
}

/**
 * Cartão de crédito
 */
export interface Card {
    id: string;
    nome_cartao: string; // Ex: "Nubank", "Itaú Platinum"
    limite: number;
    dia_fechamento: number; // 1-31
    dia_vencimento: number; // 1-31
    users_assigned: CardUser[]; // Lista de usuários que podem usar este cartão
    created_at: Date;
    updated_at: Date;
}

/**
 * Transação financeira
 */
/**
 * Status da transação
 */
export enum TransactionStatus {
    PENDING = "PENDING",
    COMPLETED = "COMPLETED",
}

export interface Transaction {
    id: string;
    descricao: string;
    valor: number;
    categoria: Category;
    data: Date; // Data da compra/transação
    tipo: TransactionType;
    metodo_pagamento: PaymentMethod;
    status?: TransactionStatus; // Default: COMPLETED

    // Campos específicos para pagamento com cartão
    card_id?: string; // ID do cartão (obrigatório se metodo_pagamento === CARTAO_CREDITO)
    account_id?: string; // ID da conta bancária (se metodo_pagamento === DINHEIRO_PIX)
    user_id_gasto?: string; // ID do usuário do cartão que realizou a compra
    mes_fatura?: string; // Formato: "YYYY-MM" - Calculado automaticamente

    // Campos de parcelamento
    parcelado?: boolean; // Se a compra foi parcelada
    numero_parcelas?: number; // Quantidade de parcelas (ex: 3, 6, 12)
    parcela_atual?: number; // Número da parcela atual (ex: 1 de 3)
    valor_parcela?: number; // Valor de cada parcela
    compra_parcelada_id?: string; // ID da compra original (para agrupar parcelas)

    // Recorrência
    is_recurring?: boolean;
    recurrence_id?: string;

    // Metadados
    created_at: Date;
    updated_at: Date;
    user_id_criador: string; // ID do usuário autenticado que criou a transação
}



/**
 * Receita (Income)
 */
export interface Income {
    id: string;
    descricao: string;
    valor: number;
    membroId: string; // ID do membro da família (CardUser)
    membroNome?: string; // Nome do membro (para exibição)
    tipo: IncomeType; // FIXA ou SAZONAL
    data_recebimento: Date; // Data programada para receber
    status: IncomeStatus; // PENDENTE ou RECEBIDO
    recorrente: boolean; // Se é recorrente (sempre true para FIXA)
    dia_recorrencia?: number; // Dia do mês (1-31) para receitas fixas

    // Metadados
    created_at: Date;
    updated_at: Date;
    ownerId: string; // ID do usuário autenticado que criou a receita
    original_income_id?: string; // ID da receita original (para recorrentes geradas automaticamente)
}

/**
 * Perfil do usuário
 */
export interface UserProfile {
    uid: string; // Matches Firebase Auth UID
    email: string;
    nome: string;
    telefone?: string;
    photoURL?: string;
    family_id?: string; // Reference to family
    role_in_family?: FamilyRole;
    created_at: Date;
    updated_at: Date;
}

/**
 * Família
 */
export interface Family {
    id: string;
    name: string; // e.g., "Família Araujo Guedes"
    owner_id: string; // User who created the family
    member_ids: string[]; // Array of user UIDs
    created_at: Date;
    updated_at: Date;
}

/**
 * Convite familiar
 */
export interface FamilyInvitation {
    id: string;
    family_id: string;
    family_name: string; // Cached for display
    invited_by: string; // User UID
    invited_by_name: string; // Cached for display
    invitation_code: string; // Unique 8-character code
    email?: string; // Optional: email of invitee
    status: InvitationStatus;

    // Advanced Invitation Fields
    invitee_name?: string;
    invitee_email?: string;
    role_label?: string; // Ex: "Esposa", "Filho"
    permissions?: {
        cards: string[]; // IDs of cards to add user to
        accounts: string[]; // IDs of accounts to share
        investments: string[]; // IDs of investments to share
    };

    expires_at: Date; // 7 days from creation
    created_at: Date;
    accepted_at?: Date;
    accepted_by?: string; // User UID who accepted
}

/**
 * Conta bancária
 */
export interface BankAccount {
    id: string;
    user_id: string; // Owner of the account
    nome_banco: string; // e.g., "Nubank", "Itaú"
    tipo_conta: AccountType;
    saldo_atual: number;
    moeda: string; // Default: 'BRL'
    is_shared: boolean; // Flag simples de visibilidade
    shared_with_uids?: string[]; // Lista específica de usuários com acesso
    created_at: Date;
    updated_at: Date;
}

/**
 * Investimento
 */
export interface Investment {
    id: string;
    account_id: string; // Reference to bank_account
    user_id: string;
    tipo: InvestmentType;
    nome: string; // e.g., "Tesouro Direto", "Bitcoin"
    shared_with_uids?: string[]; // Lista específica de usuários com acesso
    valor_investido: number;
    valor_atual: number;
    rentabilidade: number; // Percentage (Total or Current)

    // Automação e Metas
    taxa_fixa_mensal?: number; // % ao mês para cálculo automático
    aporte_mensal?: number; // Valor previsto de aporte mensal
    last_calculation_date?: Date; // Última vez que o rendimento foi calculado

    data_aplicacao: Date;
    created_at: Date;
    updated_at: Date;
}

// ============================================
// TIPOS PARA FORMULÁRIOS
// ============================================

/**
 * Dados do formulário de nova transação (antes de salvar)
 */
export interface TransactionFormData {
    descricao: string;
    valor: number;
    categoria: Category;
    data: Date;
    tipo: TransactionType;
    metodo_pagamento: PaymentMethod;
    card_id?: string;
    account_id?: string; // ID da conta bancária (opcional)
    user_id_gasto?: string;
    parcelado?: boolean;
    numero_parcelas?: number;
    status?: TransactionStatus;
    is_recurring?: boolean;
}

/**
 * Dados para criação de novo cartão
 */
export interface CardFormData {
    nome_cartao: string;
    limite: number;
    dia_fechamento: number;
    dia_vencimento: number;
}

/**
 * Dados para adicionar usuário a um cartão
 */
export interface CardUserFormData {
    nome: string;
    card_id: string;
}

/**
 * Dados para criação de nova receita
 */
export interface IncomeFormData {
    descricao: string;
    valor: number;
    membroId: string;
    tipo: IncomeType;
    data_recebimento?: Date; // Para receitas sazonais
    dia_recorrencia?: number; // Para receitas fixas (1-31)
}

/**
 * Dados para criação/edição de perfil de usuário
 */
export interface UserProfileFormData {
    nome: string;
    telefone?: string;
    photoURL?: string;
}

/**
 * Dados para criação de conta bancária
 */
export interface BankAccountFormData {
    nome_banco: string;
    tipo_conta: AccountType;
    saldo_atual: number;
    is_shared: boolean;
}

/**
 * Dados para criação de investimento
 */
export interface InvestmentFormData {
    tipo: InvestmentType;
    nome: string;
    valor_investido: number;
    valor_atual: number;
    data_aplicacao: Date;
    taxa_fixa_mensal?: number;
    aporte_mensal?: number;
}

// ============================================
// TIPOS PARA VISUALIZAÇÃO DE FATURAS
// ============================================

/**
 * Resumo de uma fatura mensal de um cartão
 */
export interface InvoiceSummary {
    card_id: string;
    card_name: string;
    mes_fatura: string; // "YYYY-MM"
    total: number;
    transactions: Transaction[];
    gastos_por_usuario: GastoPorUsuario[];
}

/**
 * Gastos agrupados por usuário em uma fatura
 */
export interface GastoPorUsuario {
    user_id: string;
    user_name: string;
    total: number;
    transactions: Transaction[];
}

// ============================================
// TIPOS PARA DASHBOARD
// ============================================

/**
 * Resumo financeiro do mês
 */
export interface MonthSummary {
    mes: string; // "YYYY-MM"
    total_rendas: number;
    total_contas_fixas: number;
    total_faturas_cartoes: number;
    saldo: number; // rendas - contas_fixas - faturas
    faturas_por_cartao: {
        card_id: string;
        card_name: string;
        total: number;
    }[];
}

// ============================================
// LABELS PARA EXIBIÇÃO
// ============================================

export const PaymentMethodLabels: Record<PaymentMethod, string> = {
    [PaymentMethod.DINHEIRO_PIX]: "Dinheiro/PIX",
    [PaymentMethod.CARTAO_CREDITO]: "Cartão de Crédito",
};

export const TransactionTypeLabels: Record<TransactionType, string> = {
    [TransactionType.RENDA]: "Renda",
    [TransactionType.CONTA_FIXA]: "Conta Fixa",
    [TransactionType.VARIAVEL]: "Variável",
};

export const CategoryLabels: Record<Category, string> = {
    // Rendas
    [Category.SALARIO]: "Salário",
    [Category.FREELANCE]: "Freelance",
    [Category.INVESTIMENTOS]: "Investimentos",
    [Category.OUTROS_RENDIMENTOS]: "Outros Rendimentos",

    // Contas Fixas
    [Category.ALUGUEL]: "Aluguel",
    [Category.ENERGIA]: "Energia",
    [Category.AGUA]: "Água",
    [Category.INTERNET]: "Internet",
    [Category.TELEFONE]: "Telefone",
    [Category.CONDOMINIO]: "Condomínio",
    [Category.ASSINATURAS]: "Assinaturas",

    // Variáveis
    [Category.ALIMENTACAO]: "Alimentação",
    [Category.TRANSPORTE]: "Transporte",
    [Category.SAUDE]: "Saúde",
    [Category.EDUCACAO]: "Educação",
    [Category.LAZER]: "Lazer",
    [Category.VESTUARIO]: "Vestuário",
    [Category.OUTROS]: "Outros",
};

export const IncomeTypeLabels: Record<IncomeType, string> = {
    [IncomeType.FIXA]: "Fixa (Recorrente)",
    [IncomeType.SAZONAL]: "Sazonal (Única)",
};

export const IncomeStatusLabels: Record<IncomeStatus, string> = {
    [IncomeStatus.PENDENTE]: "Pendente",
    [IncomeStatus.RECEBIDO]: "Recebido",
};

export const AccountTypeLabels: Record<AccountType, string> = {
    [AccountType.CORRENTE]: "Conta Corrente",
    [AccountType.POUPANCA]: "Poupança",
    [AccountType.INVESTIMENTO]: "Investimento",
};

export const InvestmentTypeLabels: Record<InvestmentType, string> = {
    [InvestmentType.ACOES]: "Ações",
    [InvestmentType.FUNDOS]: "Fundos de Investimento",
    [InvestmentType.RENDA_FIXA]: "Renda Fixa",
    [InvestmentType.CRIPTOMOEDAS]: "Criptomoedas",
    [InvestmentType.OUTROS]: "Outros",
};

export const FamilyRoleLabels: Record<FamilyRole, string> = {
    [FamilyRole.OWNER]: "Proprietário",
    [FamilyRole.MEMBER]: "Membro",
};

export const InvitationStatusLabels: Record<InvitationStatus, string> = {
    [InvitationStatus.PENDING]: "Pendente",
    [InvitationStatus.ACCEPTED]: "Aceito",
    [InvitationStatus.REJECTED]: "Rejeitado",
    [InvitationStatus.EXPIRED]: "Expirado",
};

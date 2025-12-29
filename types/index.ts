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
export interface Transaction {
    id: string;
    descricao: string;
    valor: number;
    categoria: Category;
    data: Date; // Data da compra/transação
    tipo: TransactionType;
    metodo_pagamento: PaymentMethod;

    // Campos específicos para pagamento com cartão
    card_id?: string; // ID do cartão (obrigatório se metodo_pagamento === CARTAO_CREDITO)
    user_id_gasto?: string; // ID do usuário do cartão que realizou a compra
    mes_fatura?: string; // Formato: "YYYY-MM" - Calculado automaticamente

    // Metadados
    created_at: Date;
    updated_at: Date;
    user_id_criador: string; // ID do usuário autenticado que criou a transação
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
    user_id_gasto?: string;
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

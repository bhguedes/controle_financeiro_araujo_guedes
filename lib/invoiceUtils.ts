import { format, addMonths, parseISO } from "date-fns";

/**
 * Calcula o mês da fatura baseado na data da compra e no dia de fechamento do cartão
 * 
 * Regra: Se a data da compra for APÓS o dia de fechamento, a fatura pertence ao próximo mês
 * 
 * @param dataDaCompra - Data em que a compra foi realizada
 * @param diaFechamento - Dia do mês em que o cartão fecha (1-31)
 * @returns String no formato "YYYY-MM" representando o mês da fatura
 * 
 * @example
 * // Cartão fecha dia 15
 * calcularMesFatura(new Date("2025-01-10"), 15) // "2025-01" (compra antes do fechamento)
 * calcularMesFatura(new Date("2025-01-20"), 15) // "2025-02" (compra após o fechamento)
 */
export function calcularMesFatura(
    dataDaCompra: Date,
    diaFechamento: number
): string {
    const diaCompra = dataDaCompra.getDate();

    // Se a compra foi feita APÓS o dia de fechamento, pertence à fatura do próximo mês
    if (diaCompra > diaFechamento) {
        const proximoMes = addMonths(dataDaCompra, 1);
        return format(proximoMes, "yyyy-MM");
    }

    // Se a compra foi feita ANTES ou NO dia de fechamento, pertence à fatura do mês atual
    return format(dataDaCompra, "yyyy-MM");
}

/**
 * Formata um valor monetário para exibição em Real brasileiro
 * 
 * @param valor - Valor numérico a ser formatado
 * @returns String formatada como moeda brasileira
 * 
 * @example
 * formatarMoeda(1234.56) // "R$ 1.234,56"
 */
export function formatarMoeda(valor: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(valor);
}

/**
 * Formata uma data para exibição no padrão brasileiro
 * 
 * @param data - Data a ser formatada
 * @returns String no formato "dd/MM/yyyy"
 * 
 * @example
 * formatarData(new Date("2025-01-15")) // "15/01/2025"
 */
export function formatarData(data: Date): string {
    return format(data, "dd/MM/yyyy");
}

/**
 * Converte uma string no formato "YYYY-MM" para uma descrição legível
 * 
 * @param mesFatura - String no formato "YYYY-MM"
 * @returns String formatada como "Mês/Ano"
 * 
 * @example
 * formatarMesFatura("2025-01") // "Janeiro/2025"
 */
export function formatarMesFatura(mesFatura: string): string {
    const data = parseISO(`${mesFatura}-01`);
    return format(data, "MMMM/yyyy", { locale: require("date-fns/locale/pt-BR") });
}

/**
 * Valida se um dia do mês é válido (1-31)
 * 
 * @param dia - Número do dia a ser validado
 * @returns true se o dia é válido, false caso contrário
 */
export function validarDiaDoMes(dia: number): boolean {
    return dia >= 1 && dia <= 31;
}

/**
 * Obtém o mês atual no formato "YYYY-MM"
 * 
 * @returns String representando o mês atual
 * 
 * @example
 * obterMesAtual() // "2025-01" (se estamos em janeiro de 2025)
 */
export function obterMesAtual(): string {
    return format(new Date(), "yyyy-MM");
}

/**
 * Gera uma lista de meses para navegação (6 meses anteriores e 6 posteriores)
 * 
 * @param mesReferencia - Mês de referência no formato "YYYY-MM"
 * @returns Array de strings no formato "YYYY-MM"
 */
export function gerarListaDeMeses(mesReferencia: string = obterMesAtual()): string[] {
    const dataReferencia = parseISO(`${mesReferencia}-01`);
    const meses: string[] = [];

    // 6 meses anteriores
    for (let i = 6; i > 0; i--) {
        const mes = addMonths(dataReferencia, -i);
        meses.push(format(mes, "yyyy-MM"));
    }

    // Mês atual
    meses.push(mesReferencia);

    // 6 meses posteriores
    for (let i = 1; i <= 6; i++) {
        const mes = addMonths(dataReferencia, i);
        meses.push(format(mes, "yyyy-MM"));
    }

    return meses;
}

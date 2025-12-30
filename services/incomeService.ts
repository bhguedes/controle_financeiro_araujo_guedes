import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    getDocs,
    doc,
    query,
    where,
    updateDoc,
    deleteDoc,
    Timestamp,
    orderBy,
} from "firebase/firestore";
import { Income, IncomeType, IncomeStatus } from "@/types";

// ============================================
// FUNÇÕES DE RECEITAS (INCOMES)
// ============================================

/**
 * Adiciona uma nova receita
 */
export const addIncome = async (
    userId: string,
    incomeData: {
        descricao: string;
        valor: number;
        membroId: string;
        membroNome: string;
        tipo: IncomeType;
        data_recebimento?: Date;
        dia_recorrencia?: number;
    }
): Promise<string> => {
    try {
        const recorrente = incomeData.tipo === IncomeType.FIXA;

        // Para receitas fixas, calcula a data de recebimento baseada no dia_recorrencia
        let dataRecebimento: Date;
        if (recorrente && incomeData.dia_recorrencia) {
            const hoje = new Date();
            dataRecebimento = new Date(
                hoje.getFullYear(),
                hoje.getMonth(),
                incomeData.dia_recorrencia
            );
            // Se a data já passou neste mês, agenda para o próximo mês
            if (dataRecebimento < hoje) {
                dataRecebimento.setMonth(dataRecebimento.getMonth() + 1);
            }
        } else {
            dataRecebimento = incomeData.data_recebimento || new Date();
        }

        const incomeRef = await addDoc(collection(db, "incomes"), {
            descricao: incomeData.descricao,
            valor: incomeData.valor,
            membroId: incomeData.membroId,
            membroNome: incomeData.membroNome,
            tipo: incomeData.tipo,
            data_recebimento: Timestamp.fromDate(dataRecebimento),
            status: IncomeStatus.PENDENTE,
            recorrente,
            dia_recorrencia: incomeData.dia_recorrencia || null,
            ownerId: userId,
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
        });

        return incomeRef.id;
    } catch (error) {
        console.error("Erro ao adicionar receita:", error);
        throw error;
    }
};

/**
 * Busca todas as receitas do usuário logado
 */
export const getMyIncomes = async (userId: string): Promise<Income[]> => {
    try {
        const q = query(
            collection(db, "incomes"),
            where("ownerId", "==", userId),
            orderBy("data_recebimento", "desc")
        );
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                descricao: data.descricao,
                valor: data.valor,
                membroId: data.membroId,
                membroNome: data.membroNome,
                tipo: data.tipo as IncomeType,
                data_recebimento: data.data_recebimento.toDate(),
                status: data.status as IncomeStatus,
                recorrente: data.recorrente,
                dia_recorrencia: data.dia_recorrencia,
                created_at: data.created_at.toDate(),
                updated_at: data.updated_at.toDate(),
                ownerId: data.ownerId,
            } as Income;
        });
    } catch (error) {
        console.error("Erro ao buscar receitas:", error);
        throw error;
    }
};

/**
 * Verifica e processa receitas recorrentes para o mês solicitado
 */
export const processRecurringIncomes = async (
    userId: string,
    year: number,
    month: number
): Promise<void> => {
    try {
        // 1. Busca todas as receitas originais recorrentes (que não são cópias)
        // Como o Firestore não filtra por "campo não existe", trazemos todos os recorrentes e filtramos em memória
        const q = query(
            collection(db, "incomes"),
            where("ownerId", "==", userId),
            where("recorrente", "==", true)
        );
        const snapshot = await getDocs(q);

        const templates = snapshot.docs
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    data_recebimento: data.data_recebimento.toDate ? data.data_recebimento.toDate() : new Date(data.data_recebimento.seconds * 1000)
                } as Income;
            })
            .filter(income => !income.original_income_id); // Apenas originais

        // 2. Para cada template, verifica se já existe no mês alvo
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);

        for (const template of templates) {
            // Se o template for do futuro em relação ao mês alvo, ignora
            if (template.data_recebimento > endDate) continue;

            // Se o template já é deste mês, ignora
            if (template.data_recebimento >= startDate && template.data_recebimento <= endDate) continue;

            // Verifica se já existe uma cópia para este mês
            const copyQ = query(
                collection(db, "incomes"),
                where("original_income_id", "==", template.id),
                where("data_recebimento", ">=", Timestamp.fromDate(startDate)),
                where("data_recebimento", "<=", Timestamp.fromDate(endDate))
            );
            const copySnap = await getDocs(copyQ);

            if (copySnap.empty) {
                // Cria a cópia para este mês
                const dia = template.dia_recorrencia || template.data_recebimento.getDate();

                // Cuidado com dia 31 em meses que tem menos dias
                const maxDays = new Date(year, month + 1, 0).getDate();
                const targetDay = Math.min(dia, maxDays);

                const dataRecebimento = new Date(year, month, targetDay);

                await addDoc(collection(db, "incomes"), {
                    descricao: template.descricao,
                    valor: template.valor,
                    membroId: template.membroId || "",
                    membroNome: template.membroNome || "",
                    tipo: template.tipo,
                    data_recebimento: Timestamp.fromDate(dataRecebimento),
                    status: IncomeStatus.PENDENTE,
                    recorrente: true,
                    dia_recorrencia: template.dia_recorrencia,
                    ownerId: userId,
                    original_income_id: template.id,
                    created_at: Timestamp.now(),
                    updated_at: Timestamp.now(),
                });
            }
        }
    } catch (error) {
        console.error("Erro ao processar receitas recorrentes:", error);
        // Não lança erro para não bloquear a leitura principal
    }
};

/**
 * Busca receitas de um mês específico
 */
export const getIncomesByMonth = async (
    userId: string,
    year: number,
    month: number // 0-11 (Janeiro = 0)
): Promise<Income[]> => {
    try {
        // Garante que receitas recorrentes existam para este mês
        await processRecurringIncomes(userId, year, month);

        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);

        const q = query(
            collection(db, "incomes"),
            where("ownerId", "==", userId),
            where("data_recebimento", ">=", Timestamp.fromDate(startDate)),
            where("data_recebimento", "<=", Timestamp.fromDate(endDate)),
            orderBy("data_recebimento", "asc")
        );

        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                descricao: data.descricao,
                valor: data.valor,
                membroId: data.membroId,
                membroNome: data.membroNome,
                tipo: data.tipo as IncomeType,
                data_recebimento: data.data_recebimento.toDate(),
                status: data.status as IncomeStatus,
                recorrente: data.recorrente,
                dia_recorrencia: data.dia_recorrencia,
                created_at: data.created_at.toDate(),
                updated_at: data.updated_at.toDate(),
                ownerId: data.ownerId,
            } as Income;
        });
    } catch (error) {
        console.error("Erro ao buscar receitas do mês:", error);
        throw error;
    }
};

/**
 * Atualiza uma receita existente
 */
export const updateIncome = async (
    incomeId: string,
    incomeData: Partial<{
        descricao: string;
        valor: number;
        membroId: string;
        membroNome: string;
        tipo: IncomeType;
        data_recebimento: Date;
        dia_recorrencia: number;
    }>
): Promise<void> => {
    try {
        const incomeRef = doc(db, "incomes", incomeId);
        const updateData: any = {
            ...incomeData,
            updated_at: Timestamp.now(),
        };

        // Converte data para Timestamp se fornecida
        if (incomeData.data_recebimento) {
            updateData.data_recebimento = Timestamp.fromDate(incomeData.data_recebimento);
        }

        // Atualiza recorrente se o tipo mudou
        if (incomeData.tipo) {
            updateData.recorrente = incomeData.tipo === IncomeType.FIXA;
        }

        await updateDoc(incomeRef, updateData);
    } catch (error) {
        console.error("Erro ao atualizar receita:", error);
        throw error;
    }
};

/**
 * Atualiza o status de uma receita (toggle entre PENDENTE e RECEBIDO)
 */
export const updateIncomeStatus = async (
    incomeId: string,
    newStatus: IncomeStatus
): Promise<void> => {
    try {
        const incomeRef = doc(db, "incomes", incomeId);
        await updateDoc(incomeRef, {
            status: newStatus,
            updated_at: Timestamp.now(),
        });
    } catch (error) {
        console.error("Erro ao atualizar status da receita:", error);
        throw error;
    }
};

/**
 * Remove uma receita
 */
export const deleteIncome = async (incomeId: string): Promise<void> => {
    try {
        const incomeRef = doc(db, "incomes", incomeId);
        await deleteDoc(incomeRef);
    } catch (error) {
        console.error("Erro ao deletar receita:", error);
        throw error;
    }
};

/**
 * Calcula estatísticas de receitas para um mês
 */
export const getIncomeStats = async (
    userId: string,
    year: number,
    month: number
): Promise<{
    totalPrevisto: number;
    totalRecebido: number;
    percentualRecebido: number;
    incomesPendentes: Income[];
    incomesRecebidos: Income[];
}> => {
    try {
        const incomes = await getIncomesByMonth(userId, year, month);

        const incomesPendentes = incomes.filter(
            (income) => income.status === IncomeStatus.PENDENTE
        );
        const incomesRecebidos = incomes.filter(
            (income) => income.status === IncomeStatus.RECEBIDO
        );

        const totalPrevisto = incomes.reduce((sum, income) => sum + income.valor, 0);
        const totalRecebido = incomesRecebidos.reduce(
            (sum, income) => sum + income.valor,
            0
        );
        const percentualRecebido = totalPrevisto > 0
            ? (totalRecebido / totalPrevisto) * 100
            : 0;

        return {
            totalPrevisto,
            totalRecebido,
            percentualRecebido,
            incomesPendentes,
            incomesRecebidos,
        };
    } catch (error) {
        console.error("Erro ao calcular estatísticas de receitas:", error);
        throw error;
    }
};

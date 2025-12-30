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
import { BankAccount, Investment, AccountType, InvestmentType } from "@/types";

// ============================================
// FUNÇÕES DE CONTAS BANCÁRIAS
// ============================================

/**
 * Adiciona uma nova conta bancária
 */
export const addBankAccount = async (
    userId: string,
    accountData: {
        nome_banco: string;
        tipo_conta: AccountType;
        saldo_atual: number;
        is_shared: boolean;
    }
): Promise<string> => {
    try {
        const accountRef = await addDoc(collection(db, "bank_accounts"), {
            user_id: userId,
            nome_banco: accountData.nome_banco,
            tipo_conta: accountData.tipo_conta,
            saldo_atual: accountData.saldo_atual,
            moeda: "BRL",
            is_shared: accountData.is_shared,
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
        });

        return accountRef.id;
    } catch (error) {
        console.error("Erro ao adicionar conta:", error);
        throw error;
    }
};

/**
 * Busca todas as contas do usuário
 */
export const getMyAccounts = async (userId: string): Promise<BankAccount[]> => {
    try {
        const q1 = query(collection(db, "bank_accounts"), where("user_id", "==", userId));
        const q2 = query(collection(db, "bank_accounts"), where("ownerId", "==", userId));
        const q3 = query(collection(db, "bank_accounts"), where("owner_id", "==", userId));
        const q4 = query(collection(db, "bank_accounts"), where("shared_with_uids", "array-contains", userId));

        const [snap1, snap2, snap3, snap4] = await Promise.all([
            getDocs(q1),
            getDocs(q2),
            getDocs(q3),
            getDocs(q4)
        ]);

        const docs = [...snap1.docs];
        [...snap2.docs, ...snap3.docs, ...snap4.docs].forEach(d => {
            if (!docs.find(existing => existing.id === d.id)) {
                docs.push(d);
            }
        });

        console.log("[accountService] getMyAccounts found:", docs.length);

        return docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                user_id: data.user_id || data.ownerId || data.owner_id,
                nome_banco: data.nome_banco,
                tipo_conta: data.tipo_conta as AccountType,
                saldo_atual: data.saldo_atual,
                moeda: data.moeda,
                is_shared: data.is_shared,
                created_at: data.created_at.toDate(),
                updated_at: data.updated_at.toDate(),
            };
        });
    } catch (error) {
        console.error("Erro ao buscar contas:", error);
        throw error;
    }
};

/**
 * Busca contas compartilhadas da família
 */
export const getFamilyAccounts = async (familyMemberIds: string[]): Promise<BankAccount[]> => {
    try {
        if (familyMemberIds.length === 0) return [];

        const q = query(
            collection(db, "bank_accounts"),
            where("user_id", "in", familyMemberIds),
            where("is_shared", "==", true)
        );
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                user_id: data.user_id,
                nome_banco: data.nome_banco,
                tipo_conta: data.tipo_conta as AccountType,
                saldo_atual: data.saldo_atual,
                moeda: data.moeda,
                is_shared: data.is_shared,
                created_at: data.created_at.toDate(),
                updated_at: data.updated_at.toDate(),
            };
        });
    } catch (error) {
        console.error("Erro ao buscar contas da família:", error);
        throw error;
    }
};

/**
 * Atualiza uma conta bancária
 */
export const updateBankAccount = async (
    accountId: string,
    updates: {
        nome_banco?: string;
        tipo_conta?: AccountType;
        saldo_atual?: number;
        is_shared?: boolean;
    }
): Promise<void> => {
    try {
        const accountRef = doc(db, "bank_accounts", accountId);
        await updateDoc(accountRef, {
            ...updates,
            updated_at: Timestamp.now(),
        });
    } catch (error) {
        console.error("Erro ao atualizar conta:", error);
        throw error;
    }
};

/**
 * Remove uma conta bancária
 */
export const deleteBankAccount = async (accountId: string): Promise<void> => {
    try {
        // Remove todos os investimentos da conta primeiro
        const investmentsQuery = query(
            collection(db, "investments"),
            where("account_id", "==", accountId)
        );
        const investmentsSnapshot = await getDocs(investmentsQuery);

        for (const investmentDoc of investmentsSnapshot.docs) {
            await deleteDoc(investmentDoc.ref);
        }

        // Remove a conta
        const accountRef = doc(db, "bank_accounts", accountId);
        await deleteDoc(accountRef);
    } catch (error) {
        console.error("Erro ao deletar conta:", error);
        throw error;
    }
};

// ============================================
// FUNÇÕES DE INVESTIMENTOS
// ============================================

/**
 * Adiciona um novo investimento
 */
export const addInvestment = async (
    userId: string,
    accountId: string,
    investmentData: {
        tipo: InvestmentType;
        nome: string;
        valor_investido: number;
        valor_atual: number;
        data_aplicacao: Date;
        taxa_fixa_mensal?: number;
        aporte_mensal?: number;
    }
): Promise<string> => {
    try {
        const rentabilidade = investmentData.valor_investido > 0
            ? ((investmentData.valor_atual - investmentData.valor_investido) / investmentData.valor_investido) * 100
            : 0;

        const investmentRef = await addDoc(collection(db, "investments"), {
            account_id: accountId,
            user_id: userId,
            tipo: investmentData.tipo,
            nome: investmentData.nome,
            valor_investido: investmentData.valor_investido,
            valor_atual: investmentData.valor_atual,
            rentabilidade,
            taxa_fixa_mensal: investmentData.taxa_fixa_mensal || 0,
            aporte_mensal: investmentData.aporte_mensal || 0,
            last_calculation_date: Timestamp.now(), // Marca como calculado hoje
            data_aplicacao: Timestamp.fromDate(investmentData.data_aplicacao),
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
        });

        return investmentRef.id;
    } catch (error) {
        console.error("Erro ao adicionar investimento:", error);
        throw error;
    }
};

/**
 * Busca investimentos de uma conta
 */
export const getAccountInvestments = async (accountId: string): Promise<Investment[]> => {
    try {
        const q = query(
            collection(db, "investments"),
            where("account_id", "==", accountId)
        );
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                account_id: data.account_id,
                user_id: data.user_id,
                tipo: data.tipo as InvestmentType,
                nome: data.nome,
                valor_investido: data.valor_investido,
                valor_atual: data.valor_atual,
                rentabilidade: data.rentabilidade,
                taxa_fixa_mensal: data.taxa_fixa_mensal,
                aporte_mensal: data.aporte_mensal,
                last_calculation_date: data.last_calculation_date?.toDate(),
                data_aplicacao: data.data_aplicacao.toDate(),
                created_at: data.created_at.toDate(),
                updated_at: data.updated_at.toDate(),
            };
        });
    } catch (error) {
        console.error("Erro ao buscar investimentos:", error);
        throw error;
    }
};

/**
 * Busca TODOS os investimentos do usuário ( independente da conta )
 */
export const getMyInvestments = async (userId: string): Promise<Investment[]> => {
    try {
        const q1 = query(collection(db, "investments"), where("user_id", "==", userId));
        const q2 = query(collection(db, "investments"), where("ownerId", "==", userId));
        const q3 = query(collection(db, "investments"), where("owner_id", "==", userId));
        const q4 = query(collection(db, "investments"), where("shared_with_uids", "array-contains", userId));

        const [snap1, snap2, snap3, snap4] = await Promise.all([
            getDocs(q1),
            getDocs(q2),
            getDocs(q3),
            getDocs(q4)
        ]);

        const docs = [...snap1.docs];
        [...snap2.docs, ...snap3.docs, ...snap4.docs].forEach(d => {
            if (!docs.find(existing => existing.id === d.id)) {
                docs.push(d);
            }
        });

        console.log("[accountService] getMyInvestments found:", docs.length);

        return docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                account_id: data.account_id,
                user_id: data.user_id || data.ownerId || data.owner_id,
                tipo: data.tipo as InvestmentType,
                nome: data.nome,
                valor_investido: data.valor_investido,
                valor_atual: data.valor_atual,
                rentabilidade: data.rentabilidade,
                taxa_fixa_mensal: data.taxa_fixa_mensal,
                aporte_mensal: data.aporte_mensal,
                last_calculation_date: data.last_calculation_date?.toDate(),
                data_aplicacao: data.data_aplicacao.toDate(),
                shared_with_uids: data.shared_with_uids,
                created_at: data.created_at.toDate(),
                updated_at: data.updated_at.toDate(),
            };
        });
    } catch (error) {
        console.error("Erro ao buscar todos investimentos:", error);
        throw error;
    }
};

/**
 * Atualiza um investimento
 */
export const updateInvestment = async (
    investmentId: string,
    updates: {
        nome?: string;
        valor_atual?: number;
        taxa_fixa_mensal?: number;
        aporte_mensal?: number;
    }
): Promise<void> => {
    try {
        const updateData: any = {
            ...updates,
            updated_at: Timestamp.now(),
        };

        // Recalcula rentabilidade se valor_atual mudou
        if (updates.valor_atual !== undefined) {
            const investmentRef = doc(db, "investments", investmentId);
            const investmentSnap = await getDocs(query(collection(db, "investments"), where("__name__", "==", investmentId)));

            if (!investmentSnap.empty) {
                const data = investmentSnap.docs[0].data();
                const rentabilidade = data.valor_investido > 0
                    ? ((updates.valor_atual - data.valor_investido) / data.valor_investido) * 100
                    : 0;
                updateData.rentabilidade = rentabilidade;
            }
        }

        const investmentRef = doc(db, "investments", investmentId);
        await updateDoc(investmentRef, updateData);
    } catch (error) {
        console.error("Erro ao atualizar investimento:", error);
        throw error;
    }
};

/**
 * Remove um investimento
 */
export const deleteInvestment = async (investmentId: string): Promise<void> => {
    try {
        const investmentRef = doc(db, "investments", investmentId);
        await deleteDoc(investmentRef);
    } catch (error) {
        console.error("Erro ao deletar investimento:", error);
        throw error;
    }
};

/**
 * Calcula patrimônio líquido total
 */
export const calculateNetWorth = async (userId: string): Promise<{
    totalContas: number;
    totalInvestimentos: number;
    patrimonioLiquido: number;
}> => {
    try {
        const accounts = await getMyAccounts(userId);
        const totalContas = accounts.reduce((sum, acc) => sum + acc.saldo_atual, 0);

        let totalInvestimentos = 0;
        for (const account of accounts) {
            try {
                const investments = await getAccountInvestments(account.id);
                totalInvestimentos += investments.reduce((sum, inv) => sum + inv.valor_atual, 0);
            } catch (err) {
                console.warn(`[calculateNetWorth] Erro ao buscar investimentos da conta ${account.id}:`, err);
                // Continua o loop ignorando o erro desta conta
            }
        }

        return {
            totalContas,
            totalInvestimentos,
            patrimonioLiquido: totalContas + totalInvestimentos,
        };
    } catch (error) {
        console.error("Erro ao calcular patrimônio:", error);
        throw error;
    }
};

/**
 * Verifica e aplica rendimentos mensais automáticos
 * Deve ser chamado ao carregar o dashboard
 */
export const checkAndApplyMonthlyReturns = async (userId: string): Promise<void> => {
    try {
        const accounts = await getMyAccounts(userId);

        for (const account of accounts) {
            const investments = await getAccountInvestments(account.id);

            for (const inv of investments) {
                if (inv.taxa_fixa_mensal && inv.taxa_fixa_mensal > 0) {
                    const lastCalc = inv.last_calculation_date || inv.data_aplicacao;
                    const now = new Date();

                    // Verifica se mudou o mês
                    const lastMonth = lastCalc.getMonth();
                    const currentMonth = now.getMonth();
                    const lastYear = lastCalc.getFullYear();
                    const currentYear = now.getFullYear();

                    // Se estiver em um mês diferente (futuro)
                    if (currentYear > lastYear || (currentYear === lastYear && currentMonth > lastMonth)) {
                        // Calcula meses de diferença (simplificado)
                        const monthsDiff = (currentYear - lastYear) * 12 + (currentMonth - lastMonth);

                        // Aplica rendimento: Valor * (1 + taxa)^meses
                        // Nota: Não estamos aplicando o aporte automático AQUI, pois o user pediu botão específico.
                        // Mas o user disse "o sistema deve calcular mensalmente... juntando aporte...". 
                        // Se o aporte for automático no cálculo, o valor sobe sozinho.
                        // Assumindo que o "Botão de Confirmar Meta" é o que insere o aporte.
                        // Aqui aplicamos apenas a valorização do montante.

                        const taxaDecimal = inv.taxa_fixa_mensal / 100;
                        const novoValor = inv.valor_atual * Math.pow(1 + taxaDecimal, monthsDiff);

                        // Atualiza rentabilidade % total
                        const novaRentabilidade = inv.valor_investido > 0
                            ? ((novoValor - inv.valor_investido) / inv.valor_investido) * 100
                            : 0;

                        const invRef = doc(db, "investments", inv.id);
                        await updateDoc(invRef, {
                            valor_atual: Number(novoValor.toFixed(2)),
                            rentabilidade: Number(novaRentabilidade.toFixed(2)),
                            last_calculation_date: Timestamp.now(),
                            updated_at: Timestamp.now()
                        });

                        console.log(`Rendimento aplicado para ${inv.nome}: ${novoValor}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Erro ao aplicar rendimentos automáticos:", error);
    }
};

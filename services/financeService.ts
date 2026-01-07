import { db } from "@/lib/firebase";
import { addMonths, getDaysInMonth } from "date-fns";
import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    updateDoc,
    deleteDoc,
    Timestamp,
} from "firebase/firestore";
import { Card, Transaction, CardUser, TransactionStatus } from "@/types";
import { calcularMesFatura } from "@/lib/invoiceUtils";
import { getMyAccounts } from "@/services/accountService";

// ============================================
// FUNÇÕES DE CARTÕES
// ============================================

/**
 * Cadastra um novo cartão com seus membros vinculados
 */
export const addCard = async (
    userId: string,
    cardData: {
        nome_cartao: string;
        limite: number;
        dia_fechamento: number;
        dia_vencimento: number;
    },
    members: string[] // Array de nomes dos membros
): Promise<string> => {
    try {
        // Cria o documento do cartão
        const cardRef = await addDoc(collection(db, "cards"), {
            nome_cartao: cardData.nome_cartao,
            limite: cardData.limite,
            dia_fechamento: cardData.dia_fechamento,
            dia_vencimento: cardData.dia_vencimento,
            user_id: userId,
            shared_with_uids: [], // Inicializa array de compartilhamento
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
        });

        // Adiciona os membros como subcoleção
        const usersAssignedRef = collection(db, "cards", cardRef.id, "users_assigned");

        for (const memberName of members) {
            await addDoc(usersAssignedRef, {
                nome: memberName,
                card_id: cardRef.id,
                created_at: Timestamp.now(),
            });
        }

        return cardRef.id;
    } catch (error) {
        console.error("Erro ao adicionar cartão:", error);
        throw error;
    }
};

/**
 * Busca todos os cartões do usuário logado com seus membros
 */
export const getMyCards = async (userId: string): Promise<Card[]> => {
    try {
        // Busca cartões onde o usuário é dono OU está na lista de compartilhamento
        const q1 = query(collection(db, "cards"), where("user_id", "==", userId));
        const q2 = query(collection(db, "cards"), where("ownerId", "==", userId));
        const q3 = query(collection(db, "cards"), where("owner_id", "==", userId));
        const q4 = query(collection(db, "cards"), where("shared_with_uids", "array-contains", userId));

        console.log(`[DEBUG] Executing getMyCards for userId: ${userId}`);

        const executeQuery = async (q: any, name: string) => {
            try {
                const snap = await getDocs(q);
                console.log(`[DEBUG] ${name} success: ${snap.size} docs`);
                return snap;
            } catch (e: any) {
                console.error(`[DEBUG] ${name} FAILED:`, e.code, e.message);
                return { docs: [], size: 0 } as any;
            }
        };

        const [snap1, snap2, snap3, snap4] = await Promise.all([
            executeQuery(q1, "q1 (user_id)"),
            executeQuery(q2, "q2 (ownerId)"),
            executeQuery(q3, "q3 (owner_id)"),
            executeQuery(q4, "q4 (shared_with_uids)")
        ]);

        console.log(`[getMyCards] Query results for ${userId}:`, {
            q1: snap1.size,
            q2: snap2.size,
            q3: snap3.size,
            q4: snap4.size
        });

        const docs = [...snap1.docs];
        [...snap2.docs, ...snap3.docs, ...snap4.docs].forEach(d => {
            if (!docs.find(existing => existing.id === d.id)) {
                docs.push(d);
            }
        });

        console.log(`[getMyCards] Total unique cards found: ${docs.length}`);

        const cards: Card[] = [];

        for (const cardDoc of docs) {
            const cardData = cardDoc.data();

            // Busca os membros do cartão
            const usersAssignedRef = collection(db, "cards", cardDoc.id, "users_assigned");
            const usersSnapshot = await getDocs(usersAssignedRef);

            const users_assigned: CardUser[] = usersSnapshot.docs.map((userDoc) => ({
                id: userDoc.id,
                nome: userDoc.data().nome,
                card_id: cardDoc.id,
                created_at: userDoc.data().created_at.toDate(),
            }));

            cards.push({
                id: cardDoc.id,
                user_id: cardData.user_id || cardData.ownerId || cardData.owner_id,
                nome_cartao: cardData.nome_cartao,
                limite: cardData.limite,
                dia_fechamento: cardData.dia_fechamento,
                dia_vencimento: cardData.dia_vencimento,
                users_assigned,
                created_at: cardData.created_at.toDate(),
                updated_at: cardData.updated_at.toDate(),
            });
        }

        return cards;
    } catch (error) {
        console.error("Erro ao buscar cartões:", error);
        throw error;
    }
};

/**
 * Busca um cartão específico pelo ID
 */
export const getCard = async (cardId: string): Promise<Card | null> => {
    try {
        const cardRef = doc(db, "cards", cardId);
        const cardSnap = await getDoc(cardRef);

        if (!cardSnap.exists()) {
            return null;
        }

        const cardData = cardSnap.data();

        // Busca os membros do cartão
        const usersAssignedRef = collection(db, "cards", cardId, "users_assigned");
        const usersSnapshot = await getDocs(usersAssignedRef);

        const users_assigned: CardUser[] = usersSnapshot.docs.map((userDoc) => ({
            id: userDoc.id,
            nome: userDoc.data().nome,
            card_id: cardId,
            created_at: userDoc.data().created_at.toDate(),
        }));

        return {
            id: cardSnap.id,
            nome_cartao: cardData.nome_cartao,
            limite: cardData.limite,
            dia_fechamento: cardData.dia_fechamento,
            dia_vencimento: cardData.dia_vencimento,
            users_assigned,
            created_at: cardData.created_at.toDate(),
            updated_at: cardData.updated_at.toDate(),
        } as Card;
    } catch (error) {
        console.error("Erro ao buscar cartão:", error);
        throw error;
    }
};

/**
 * Atualiza os dados de um cartão
 */
export const updateCard = async (
    cardId: string,
    cardData: {
        nome_cartao?: string;
        limite?: number;
        dia_fechamento?: number;
        dia_vencimento?: number;
    }
): Promise<void> => {
    try {
        const cardRef = doc(db, "cards", cardId);
        await updateDoc(cardRef, {
            ...cardData,
            updated_at: Timestamp.now(),
        });
    } catch (error) {
        console.error("Erro ao atualizar cartão:", error);
        throw error;
    }
};

/**
 * Remove um cartão e todos os seus membros
 */
export const deleteCard = async (cardId: string): Promise<void> => {
    try {
        // Remove todos os membros primeiro
        const usersAssignedRef = collection(db, "cards", cardId, "users_assigned");
        const usersSnapshot = await getDocs(usersAssignedRef);

        for (const userDoc of usersSnapshot.docs) {
            await deleteDoc(userDoc.ref);
        }

        // Remove o cartão
        const cardRef = doc(db, "cards", cardId);
        await deleteDoc(cardRef);
    } catch (error) {
        console.error("Erro ao deletar cartão:", error);
        throw error;
    }
};

/**
 * Adiciona um novo membro a um cartão existente
 */
export const addCardMember = async (
    cardId: string,
    memberName: string
): Promise<string> => {
    try {
        const usersAssignedRef = collection(db, "cards", cardId, "users_assigned");
        const memberRef = await addDoc(usersAssignedRef, {
            nome: memberName,
            card_id: cardId,
            created_at: Timestamp.now(),
        });

        return memberRef.id;
    } catch (error) {
        console.error("Erro ao adicionar membro:", error);
        throw error;
    }
};

/**
 * Remove um membro de um cartão
 */
export const removeCardMember = async (
    cardId: string,
    memberId: string
): Promise<void> => {
    try {
        const memberRef = doc(db, "cards", cardId, "users_assigned", memberId);
        await deleteDoc(memberRef);
    } catch (error) {
        console.error("Erro ao remover membro:", error);
        throw error;
    }
};

// ============================================
// FUNÇÕES DE TRANSAÇÕES
// ============================================

/**
 * Processa as despesas recorrentes (Contas Fixas) para o mês especificado.
 * Gera transações pendentes se ainda não existirem.
 */
export const processRecurringExpenses = async (userId: string, targetDate: Date = new Date()): Promise<void> => {
    try {
        // 1. Busca todas as despesas marcadas como recorrentes (Modelos)
        const qRecurring = query(
            collection(db, "transactions"),
            where("user_id_criador", "==", userId),
            where("is_recurring", "==", true),
            // where("tipo", "==", TransactionType.CONTA_FIXA) // Opcional, mas usualmente Contas Fixas
            // Nota: Recorrência é marcada no pai. O pai é o modelo.
        );

        const recurringSnap = await getDocs(qRecurring);
        if (recurringSnap.empty) return;

        // 2. Para cada despesa recorrente, verifica se já existe uma cópia para o mês alvo
        for (const docModel of recurringSnap.docs) {
            const model = docModel.data() as Transaction;

            // Ignora se o modelo foi criado APÓS o mês alvo (não gera retroativo antes da criação)
            // Mas permite gerar no mês de criação se ainda não existir
            // Tratamento de data
            const modelDataRaw = (model.data as any);
            const modelData = modelDataRaw.toDate ? modelDataRaw.toDate() : modelDataRaw;

            // Ignora se o modelo foi criado APÓS o mês alvo (não gera retroativo antes da criação)
            // Adianta para dia 1 do mês alvo para comparação segura (ignora dia)
            const dSafe = new Date(modelData);
            dSafe.setHours(12, 0, 0, 0); // Normalize time
            if (dSafe > addMonths(targetDate, 1)) continue;

            const targetMonth = targetDate.getMonth();
            const targetYear = targetDate.getFullYear();

            // Busca se já existe uma transação gerada a partir deste ID para este mês
            const qExisting = query(
                collection(db, "transactions"),
                where("recurrence_id", "==", docModel.id)
            );

            // Esta query busca TODAS as ocorrências. Precisamos filtrar em memória pelo mês/ano
            // Idealmente teríamos um campo 'mes_referencia' ou algo assim, mas vamos usar a data.
            const existingSnap = await getDocs(qExisting);
            const alreadyGenerated = existingSnap.docs.some(d => {
                const dRaw = d.data().data;
                const dData = (dRaw as any).toDate ? (dRaw as any).toDate() : dRaw;
                return dData.getMonth() === targetMonth && dData.getFullYear() === targetYear;
            });

            if (!alreadyGenerated) {
                // Gera a nova despesa
                // FIX: Prevent overflow for EOM dates (e.g. 31st) -> Clip to last day of month
                const lastDayOfMonth = getDaysInMonth(new Date(targetYear, targetMonth));
                const dayToSet = Math.min(modelData.getDate(), lastDayOfMonth);

                const newDate = new Date(targetYear, targetMonth, dayToSet, 12, 0, 0);

                await addDoc(collection(db, "transactions"), {
                    ...model,
                    id: undefined, // Remove ID original
                    data: Timestamp.fromDate(newDate),
                    is_recurring: false, // Instância não é o modelo recorrente
                    recurrence_id: docModel.id, // Link com o pai
                    status: TransactionStatus.PENDING, // Sempre gera como Pendente
                    created_at: Timestamp.now(),
                    updated_at: Timestamp.now()
                });
                console.log(`Gerada despesa recorrente: ${model.descricao} para ${targetMonth + 1}/${targetYear}`);
            }
        }
    } catch (error) {
        console.error("Erro ao processar despesas recorrentes:", error);
    }
};

/**
 * Salva uma nova transação com cálculo automático de fatura
 */
export const addTransaction = async (
    userId: string,
    transactionData: Omit<Transaction, "id" | "created_at" | "updated_at" | "user_id_criador">
): Promise<string> => {
    try {
        const isParcelado = transactionData.parcelado && transactionData.numero_parcelas && transactionData.numero_parcelas > 1;

        // Se parcela_atual for fornecida (importação), usamos ela como início. Senão começa da 1.
        const startP = (typeof transactionData.parcela_atual === 'number') ? transactionData.parcela_atual : 1;

        // Se for parcelado, vai até o total. Se não, vai até 1 (ou até startP se por algum motivo bizarro for > 1 mas não parcelado)
        const endP = isParcelado ? transactionData.numero_parcelas! : 1;

        // Se for importação:
        // O valor que vem no transactionData é o valor da parcela (ex: R$ 100 de 1000).
        // Se for criação manual (parcelado=true, parcela_atual=undefined):
        // O valor geralmente é o total, e dividimos.

        let valorParcela: number;
        if (typeof transactionData.parcela_atual === 'number') {
            // Importação: o valor já é o da parcela
            valorParcela = transactionData.valor;
        } else {
            // Criação manual: divide o valor total
            valorParcela = isParcelado ? (transactionData.valor / endP) : transactionData.valor;
        }

        const compraParceladaId = isParcelado
            ? transactionData.compra_parcelada_id || doc(collection(db, "transactions")).id
            : undefined;

        // Loop: de startP até endP
        // Ex: Importou 4/12. startP=4, endP=12. Loop 4, 5... 12.
        for (let p = startP; p <= endP; p++) {
            let mesFatura: string | undefined;

            // O offset de mês é relativo ao primeiro item que estamos criando.
            // Se estamos criando o item 4 (data X), o item 5 será X + 1 mês.
            // i = p - startP (0, 1, 2...)
            const monthOffset = p - startP;

            // Usa date-fns para adicionar meses com segurança
            // FIX: Normalize date to noon to prevent timezone skipping (e.g. Jan 31 -> Mar 3)
            const baseDate = new Date(transactionData.data);
            // Create a safe date object (noon)
            const safeDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 12, 0, 0);

            const currentDate = addMonths(safeDate, monthOffset);

            // Se for pagamento com cartão, calcula o mês da fatura para esta parcela
            if (transactionData.card_id && transactionData.metodo_pagamento === "CARTAO_CREDITO") {
                // Se for a primeira parcela sendo criada (offset 0) e já veio o mês da fatura (importação), usa ele.
                // Mas se for as futuras (offset > 0), TEM que recalcular, pois muda o mês.
                if (monthOffset === 0 && transactionData.mes_fatura) {
                    mesFatura = transactionData.mes_fatura;
                } else {
                    const cardRef = doc(db, "cards", transactionData.card_id);
                    const cardSnap = await getDoc(cardRef);

                    if (cardSnap.exists()) {
                        const cardData = cardSnap.data();
                        mesFatura = calcularMesFatura(
                            currentDate,
                            cardData.dia_fechamento
                        );
                    }
                }
            }

            // Prepara descrição
            const descricao = isParcelado
                ? `${transactionData.descricao} (${p}/${endP})`
                : transactionData.descricao;

            // payload base
            const payload: any = {
                ...transactionData,
                descricao,
                valor: valorParcela,
                data: Timestamp.fromDate(currentDate),
                parcelado: isParcelado || false,
                compra_parcelada_id: compraParceladaId || null,
                user_id_criador: userId,
                status: transactionData.status || TransactionStatus.COMPLETED,
                is_recurring: transactionData.is_recurring || false,
                created_at: Timestamp.now(),
                updated_at: Timestamp.now(),
            };

            if (transactionData.recurrence_id) {
                payload.recurrence_id = transactionData.recurrence_id;
            }

            if (mesFatura) payload.mes_fatura = mesFatura;

            if (isParcelado) {
                payload.numero_parcelas = endP;
                payload.parcela_atual = p;
                payload.valor_parcela = valorParcela;
            }

            // Remove campos undefined
            Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

            await addDoc(collection(db, "transactions"), payload);
        }

        return compraParceladaId || "success";
    } catch (error) {
        console.error("Erro ao adicionar transação:", error);
        throw error;
    }
};

/**
 * Busca todas as transações do usuário (criadas por ele OU vinculadas a seus cartões/contas compartilhados)
 */
export const getMyTransactions = async (userId: string): Promise<Transaction[]> => {
    try {
        // 1. Busca cartões e contas acessíveis para saber quais transações de terceiros o usuário pode ver
        const [myCards, myAccounts] = await Promise.all([
            getMyCards(userId),
            getMyAccounts(userId)
        ]);

        const cardIds = myCards.map(c => c.id);
        const accountIds = myAccounts.map(a => a.id);

        // 2. Query 1: Transações criadas pelo próprio usuário
        const qByCreator = query(
            collection(db, "transactions"),
            where("user_id_criador", "==", userId)
        );

        // 3. Query 2: Transações vinculadas aos cartões acessíveis
        // Nota: O operador 'in' do Firestore limita a 10 itens. Se houver mais, precisaremos de múltiplas queries.
        let docs: any[] = [];
        const creatorSnap = await getDocs(qByCreator);
        docs = [...creatorSnap.docs];

        if (cardIds.length > 0) {
            const chunks = [];
            for (let i = 0; i < cardIds.length; i += 10) {
                chunks.push(cardIds.slice(i, i + 10));
            }

            for (const chunk of chunks) {
                const qByCards = query(
                    collection(db, "transactions"),
                    where("card_id", "in", chunk)
                );
                const cardsSnap = await getDocs(qByCards);
                cardsSnap.docs.forEach((d: any) => {
                    if (!docs.find((existing: any) => existing.id === d.id)) {
                        docs.push(d);
                    }
                });
            }
        }

        // 4. Query 3: Transações vinculadas às contas acessíveis (Ex: Contas Fixas pagas via conta corrente)
        if (accountIds.length > 0) {
            const chunks = [];
            for (let i = 0; i < accountIds.length; i += 10) {
                chunks.push(accountIds.slice(i, i + 10));
            }

            for (const chunk of chunks) {
                const qByAccounts = query(
                    collection(db, "transactions"),
                    where("account_id", "in", chunk)
                );
                const accountsSnap = await getDocs(qByAccounts);
                accountsSnap.docs.forEach((d: any) => {
                    if (!docs.find((existing: any) => existing.id === d.id)) {
                        docs.push(d);
                    }
                });
            }
        }

        return docs.map((doc: any) => {
            const data = doc.data();
            return {
                id: doc.id,
                descricao: data.descricao,
                valor: data.valor,
                categoria: data.categoria,
                data: data.data.toDate ? data.data.toDate() : data.data,
                tipo: data.tipo,
                metodo_pagamento: data.metodo_pagamento,
                card_id: data.card_id,
                user_id_gasto: data.user_id_gasto,
                mes_fatura: data.mes_fatura,
                status: data.status,
                parcelado: data.parcelado,
                numero_parcelas: data.numero_parcelas,
                parcela_atual: data.parcela_atual,
                compra_parcelada_id: data.compra_parcelada_id,
                created_at: data.created_at.toDate(),
                updated_at: data.updated_at.toDate(),
                user_id_criador: data.user_id_criador,
                account_id: data.account_id, // Ensure account_id is mapped
            } as Transaction;
        });
    } catch (error) {
        console.error("Erro ao buscar transações:", error);
        throw error;
    }
};

/**
 * Busca transações de um cartão específico
 */
export const getTransactionsByCard = async (
    cardId: string,
    mesFatura?: string
): Promise<Transaction[]> => {
    try {
        let q;

        if (mesFatura) {
            q = query(
                collection(db, "transactions"),
                where("card_id", "==", cardId),
                where("mes_fatura", "==", mesFatura)
            );
        } else {
            q = query(collection(db, "transactions"), where("card_id", "==", cardId));
        }

        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                descricao: data.descricao,
                valor: data.valor,
                categoria: data.categoria,
                data: data.data.toDate ? data.data.toDate() : data.data,
                tipo: data.tipo,
                metodo_pagamento: data.metodo_pagamento,
                card_id: data.card_id,
                user_id_gasto: data.user_id_gasto,
                mes_fatura: data.mes_fatura,
                created_at: data.created_at.toDate(),
                updated_at: data.updated_at.toDate(),
                user_id_criador: data.user_id_criador,
            } as Transaction;
        });
    } catch (error) {
        console.error("Erro ao buscar transações do cartão:", error);
        throw error;
    }
};

/**
 * Atualiza uma transação existente
 */
export const updateTransaction = async (
    transactionId: string,
    transactionData: Partial<Transaction>
): Promise<void> => {
    try {
        const transactionRef = doc(db, "transactions", transactionId);
        await updateDoc(transactionRef, {
            ...transactionData,
            updated_at: Timestamp.now(),
        });
    } catch (error) {
        console.error("Erro ao atualizar transação:", error);
        throw error;
    }
};

/**
 * Remove uma transação
 */
export const deleteTransaction = async (transactionId: string): Promise<void> => {
    try {
        const transactionRef = doc(db, "transactions", transactionId);
        await deleteDoc(transactionRef);
    } catch (error) {
        console.error("Erro ao deletar transação:", error);
        throw error;
    }
};

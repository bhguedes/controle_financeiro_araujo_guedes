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
    writeBatch,
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

/**
 * Atualiza o nome de um membro do cartão
 */
export const updateCardMember = async (
    cardId: string,
    memberId: string,
    newName: string
): Promise<void> => {
    try {
        const memberRef = doc(db, "cards", cardId, "users_assigned", memberId);
        await updateDoc(memberRef, {
            nome: newName,
            // updated_at: Timestamp.now(), // Membros simples podem não ter este campo, mas ok enviar
        });
    } catch (error) {
        console.error("Erro ao atualizar membro:", error);
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
        console.log(`[processRecurringExpenses] Starting for user ${userId} and date ${targetDate.toISOString()}`);

        // 1. Busca todas as despesas marcadas como recorrentes (Modelos)
        const qRecurring = query(
            collection(db, "transactions"),
            where("user_id_criador", "==", userId),
            where("is_recurring", "==", true),
            // where("tipo", "==", TransactionType.CONTA_FIXA) // Opcional, mas usualmente Contas Fixas
            // Nota: Recorrência é marcada no pai. O pai é o modelo.
        );

        const recurringSnap = await getDocs(qRecurring);
        console.log(`[processRecurringExpenses] Found ${recurringSnap.size} recurring models.`);

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
            if (dSafe > addMonths(targetDate, 1)) {
                console.log(`[processRecurringExpenses] Skipping ${model.descricao}: Created ${dSafe.toISOString()} > Target + 1 month`);
                continue;
            }

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

            console.log(`[processRecurringExpenses] Model '${model.descricao}' ID: ${docModel.id}. Already generated for ${targetMonth + 1}/${targetYear}? ${alreadyGenerated}`);

            if (!alreadyGenerated) {
                // Gera a nova despesa
                // FIX: Prevent overflow for EOM dates (e.g. 31st) -> Clip to last day of month
                const lastDayOfMonth = getDaysInMonth(new Date(targetYear, targetMonth));
                const dayToSet = Math.min(modelData.getDate(), lastDayOfMonth);

                const newDate = new Date(targetYear, targetMonth, dayToSet, 12, 0, 0);

                // Safe clone without ID
                const { id: _ignoredId, ...modelSafe } = model as any;

                await addDoc(collection(db, "transactions"), {
                    ...modelSafe,
                    data: Timestamp.fromDate(newDate),
                    is_recurring: false, // Instância não é o modelo recorrente
                    recurrence_id: docModel.id, // Link com o pai
                    status: TransactionStatus.PENDING, // Sempre gera como Pendente
                    created_at: Timestamp.now(),
                    updated_at: Timestamp.now()
                });
                console.log(`[processRecurringExpenses] GENERATED: ${model.descricao} para ${targetMonth + 1}/${targetYear}`);
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
    transactionData: Omit<Transaction, "id" | "created_at" | "updated_at" | "user_id_criador">,
    options?: { generate_future_installments?: boolean; use_purchase_date_logic?: boolean; backfill_past_installments?: boolean }
): Promise<string> => {
    try {
        const isParcelado = transactionData.parcelado && transactionData.numero_parcelas && transactionData.numero_parcelas > 1;

        // Se parcela_atual for fornecida (importação), usamos ela como âncora. Senão assume 1.
        const inputP = (typeof transactionData.parcela_atual === 'number') ? transactionData.parcela_atual : 1;

        // Se flag backfill ativa, começa da 1. Senão começa da inputP.
        const startP = options?.backfill_past_installments ? 1 : inputP;

        // Configuração: Gerar parcelas futuras? (Default: true)
        // Se False (ex: Importação CSV), cria apenas o registro atual, sem projetar o futuro.
        const generateFuture = options?.generate_future_installments !== false;

        // Se for parcelado e flag ativa, vai até o total. Se não, gera apenas a parcela atual (startP).
        // Se generateFuture=false, mas backfill=true? Geralmente queremos apenas o range solicitado.
        // Mas se generateFuture=false, endP não deve passar de inputP (ou startP?).
        // Ajuste: Se generateFuture=false, endP = inputP. 
        const endP = (isParcelado && generateFuture) ? transactionData.numero_parcelas! : inputP;

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
            valorParcela = isParcelado ? (transactionData.valor / transactionData.numero_parcelas!) : transactionData.valor;
        }

        const compraParceladaId = isParcelado
            ? transactionData.compra_parcelada_id || doc(collection(db, "transactions")).id
            : undefined;

        // Pré-cálculo da Fatura Inicial para garantir sequencialidade
        let initialInvoiceDate: Date | null = null;

        // ... (Invoice Logic Unchanged) ...
        if (transactionData.card_id && transactionData.metodo_pagamento === "CARTAO_CREDITO") {
            if (transactionData.mes_fatura) {
                const [y, m] = transactionData.mes_fatura.split('-').map(Number);
                initialInvoiceDate = new Date(y, m - 1, 1);
            } else {
                const cardRef = doc(db, "cards", transactionData.card_id);
                const cardSnap = await getDoc(cardRef);
                if (cardSnap.exists()) {
                    const cardData = cardSnap.data();
                    const baseDate = new Date(transactionData.data);
                    if (baseDate.getDate() > cardData.dia_fechamento) {
                        initialInvoiceDate = addMonths(baseDate, 1);
                    } else {
                        initialInvoiceDate = baseDate;
                    }
                }
            }
        }

        // Loop: de startP até endP
        for (let p = startP; p <= endP; p++) {
            let mesFatura: string | undefined;

            // O offset de mês é relativo à âncora (inputP).
            // Se use_purchase_date_logic=true (Data = Parcela 1), offset = p-1.
            // Se use_purchase_date_logic=false (Data = Parcela inputP), offset = p-inputP.
            const isPurchaseDateLogic = options?.use_purchase_date_logic || false;
            const monthOffset = isPurchaseDateLogic ? (p - 1) : (p - inputP);

            // Usa date-fns para adicionar meses com segurança
            // FIX: Normalize date to noon to prevent timezone skipping (e.g. Jan 31 -> Mar 3)
            const baseDate = new Date(transactionData.data);

            // Debug Log for Date Shift
            console.log(`[addTransaction] Loop ${p}/${endP}. Input Data: ${transactionData.data} (Type: ${typeof transactionData.data}). BaseDate: ${baseDate.toISOString()}`);

            // Create a safe date object (noon)
            const safeDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 12, 0, 0);

            const currentDate = addMonths(safeDate, monthOffset);
            console.log(`[addTransaction] SafeDate: ${safeDate.toISOString()}, CurrentDate: ${currentDate.toISOString()}`);

            // --- CÁLCULO DE FATURA SEQUENCIAL ---
            // Se temos uma data base de fatura, incrementamos meses a partir dela
            if (initialInvoiceDate) {
                // Sequencial: Fatura Base + Posição
                // Se p=1, offset=0.
                const invoiceDateForInstallment = addMonths(initialInvoiceDate, monthOffset);

                const y = invoiceDateForInstallment.getFullYear();
                const m = String(invoiceDateForInstallment.getMonth() + 1).padStart(2, '0');
                mesFatura = `${y}-${m}`;
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
                // Transações parceladas NÃO devem ser recorrentes (para evitar duplicação por processRecurringExpenses)
                is_recurring: isParcelado ? false : (transactionData.is_recurring || false),
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

            // Garantir que ID não existe no payload (Firestore erro: Unsupported field value: undefined found in field id)
            if ('id' in payload) delete payload.id;

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
export const deleteTransactionsBulk = async (transactionIds: string[]): Promise<void> => {
    try {
        const chunkSize = 500;
        for (let i = 0; i < transactionIds.length; i += chunkSize) {
            const chunk = transactionIds.slice(i, i + chunkSize);
            const batch = writeBatch(db);
            chunk.forEach(id => {
                const ref = doc(db, "transactions", id);
                batch.delete(ref);
            });
            await batch.commit();
        }
    } catch (error) {
        console.error("Erro ao deletar transações em massa:", error);
        throw error;
    }
};

export const updateTransactionsBulkMember = async (transactionIds: string[], userIdGasto: string): Promise<void> => {
    try {
        const batch = writeBatch(db);
        transactionIds.forEach(id => {
            const ref = doc(db, "transactions", id);
            batch.update(ref, { user_id_gasto: userIdGasto, updated_at: new Date() });
        });
        await batch.commit();
    } catch (error) {
        console.error("Error bulk updating members:", error);
        throw error;
    }
};

export const assignMemberToPurchase = async (transactionId: string, memberId: string): Promise<void> => {
    try {
        const transRef = doc(db, "transactions", transactionId);
        const transSnap = await getDoc(transRef);

        if (!transSnap.exists()) throw new Error("Transaction not found");

        const data = transSnap.data();
        const compraParceladaId = data.compra_parcelada_id;

        if (compraParceladaId) {
            // Update ALL installments associated with this purchase
            const q = query(
                collection(db, "transactions"),
                where("compra_parcelada_id", "==", compraParceladaId)
            );
            const querySnapshot = await getDocs(q);

            const batch = writeBatch(db);
            querySnapshot.docs.forEach(doc => {
                batch.update(doc.ref, {
                    user_id_gasto: memberId,
                    updated_at: new Date()
                });
            });
            await batch.commit();
        } else {
            // Single transaction update
            await updateDoc(transRef, {
                user_id_gasto: memberId,
                updated_at: new Date()
            });
        }
    } catch (error) {
        console.error("Error assigning member to purchase:", error);
        throw error;
    }
};

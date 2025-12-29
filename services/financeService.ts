import { db } from "@/lib/firebase";
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
import { Card, Transaction, CardUser } from "@/types";
import { calcularMesFatura } from "@/lib/invoiceUtils";

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
            ownerId: userId,
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
        const q = query(collection(db, "cards"), where("ownerId", "==", userId));
        const querySnapshot = await getDocs(q);

        const cards: Card[] = [];

        for (const cardDoc of querySnapshot.docs) {
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
 * Salva uma nova transação com cálculo automático de fatura
 */
export const addTransaction = async (
    userId: string,
    transactionData: Omit<Transaction, "id" | "created_at" | "updated_at" | "user_id_criador">
): Promise<string> => {
    try {
        let mesFatura: string | undefined;

        // Se for pagamento com cartão, calcula o mês da fatura
        if (transactionData.card_id && transactionData.metodo_pagamento === "CARTAO_CREDITO") {
            // Busca o cartão para pegar o dia de fechamento
            const cardRef = doc(db, "cards", transactionData.card_id);
            const cardSnap = await getDoc(cardRef);

            if (cardSnap.exists()) {
                const cardData = cardSnap.data();
                mesFatura = calcularMesFatura(
                    transactionData.data,
                    cardData.dia_fechamento
                );
            }
        }

        const transactionRef = await addDoc(collection(db, "transactions"), {
            ...transactionData,
            mes_fatura: mesFatura,
            user_id_criador: userId,
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
        });

        return transactionRef.id;
    } catch (error) {
        console.error("Erro ao adicionar transação:", error);
        throw error;
    }
};

/**
 * Busca todas as transações do usuário
 */
export const getMyTransactions = async (userId: string): Promise<Transaction[]> => {
    try {
        const q = query(
            collection(db, "transactions"),
            where("user_id_criador", "==", userId)
        );
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

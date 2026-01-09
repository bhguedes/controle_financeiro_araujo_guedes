import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    getDoc,
    getDocs,
    doc,
    query,
    where,
    updateDoc,
    deleteDoc,
    Timestamp,
    arrayUnion,
    arrayRemove,
    writeBatch,
    deleteField
} from "firebase/firestore";
import { Family, FamilyInvitation, InvitationStatus, FamilyRole } from "@/types";
import { addCardMember } from "./financeService";

// ============================================
// FUNÇÕES DE FAMÍLIA
// ============================================

/**
 * Cria uma nova família
 */
export const createFamily = async (
    ownerId: string,
    ownerName: string,
    familyName: string
): Promise<string> => {
    try {
        // Cria a família
        const familyRef = await addDoc(collection(db, "families"), {
            name: familyName,
            owner_id: ownerId,
            member_ids: [ownerId],
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
        });

        // Atualiza o perfil do usuário com a família
        const userRef = doc(db, "users", ownerId);
        await updateDoc(userRef, {
            family_id: familyRef.id,
            role_in_family: FamilyRole.OWNER,
            updated_at: Timestamp.now(),
        });

        return familyRef.id;
    } catch (error) {
        console.error("Erro ao criar família:", error);
        throw error;
    }
};

/**
 * Busca informações da família
 */
export const getFamily = async (familyId: string): Promise<Family | null> => {
    try {
        const familyRef = doc(db, "families", familyId);
        const familySnap = await getDoc(familyRef);

        if (!familySnap.exists()) {
            return null;
        }

        const data = familySnap.data();
        return {
            id: familySnap.id,
            name: data.name,
            owner_id: data.owner_id,
            member_ids: data.member_ids,
            created_at: data.created_at.toDate(),
            updated_at: data.updated_at.toDate(),
        };
    } catch (error) {
        console.error("Erro ao buscar família:", error);
        throw error;
    }
};

// ============================================
// FUNÇÕES DE CONVITE
// ============================================

/**
 * Gera código único de convite (8 caracteres)
 */
const generateInvitationCode = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

/**
 * Cria um novo convite familiar
 */
export const createInvitation = async (
    familyId: string,
    familyName: string,
    invitedBy: string,
    invitedByName: string,
    inviteeName: string,
    inviteeEmail: string,
    roleLabel: string,
    permissions: {
        cards: string[];
        accounts: string[];
        investments: string[];
    }
): Promise<{ id: string; code: string }> => {
    try {
        const code = generateInvitationCode();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expira em 7 dias

        const invitationRef = await addDoc(collection(db, "family_invitations"), {
            family_id: familyId,
            family_name: familyName,
            invited_by: invitedBy,
            invited_by_name: invitedByName,
            invitation_code: code,
            invitee_name: inviteeName,
            invitee_email: inviteeEmail,
            role_label: roleLabel,
            permissions,
            email: inviteeEmail, // Mantendo compatibilidade com campo antigo
            status: InvitationStatus.PENDING,
            expires_at: Timestamp.fromDate(expiresAt),
            created_at: Timestamp.now(),
        });

        return {
            id: invitationRef.id,
            code,
        };
    } catch (error) {
        console.error("Erro ao criar convite:", error);
        throw error;
    }
};

/**
 * Busca convite por código
 */
export const getInvitationByCode = async (
    code: string
): Promise<FamilyInvitation | null> => {
    try {
        const q = query(
            collection(db, "family_invitations"),
            where("invitation_code", "==", code.toUpperCase())
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return null;
        }

        const doc = querySnapshot.docs[0];
        const data = doc.data();

        return {
            id: doc.id,
            family_id: data.family_id,
            family_name: data.family_name,
            invited_by: data.invited_by,
            invited_by_name: data.invited_by_name,
            invitation_code: data.invitation_code,
            email: data.email,
            status: data.status as InvitationStatus,
            expires_at: data.expires_at.toDate(),
            created_at: data.created_at.toDate(),
            accepted_at: data.accepted_at?.toDate(),
            accepted_by: data.accepted_by,
        };
    } catch (error) {
        console.error("Erro ao buscar convite:", error);
        throw error;
    }
};

/**
 * Aceita um convite e adiciona usuário à família
 */
export const acceptInvitation = async (
    invitationId: string,
    userId: string
): Promise<void> => {
    try {
        // Busca o convite
        const invitationRef = doc(db, "family_invitations", invitationId);
        const invitationSnap = await getDoc(invitationRef);

        if (!invitationSnap.exists()) {
            throw new Error("Convite não encontrado");
        }

        const invitation = invitationSnap.data();

        // Verifica se já expirou
        if (invitation.expires_at.toDate() < new Date()) {
            await updateDoc(invitationRef, {
                status: InvitationStatus.EXPIRED,
            });
            throw new Error("Convite expirado");
        }

        // Verifica se já foi aceito
        if (invitation.status !== InvitationStatus.PENDING) {
            throw new Error("Convite já foi processado");
        }

        // Adiciona usuário à família
        const familyRef = doc(db, "families", invitation.family_id);
        await updateDoc(familyRef, {
            member_ids: arrayUnion(userId),
            updated_at: Timestamp.now(),
        });

        // Atualiza perfil do usuário
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            family_id: invitation.family_id,
            role_in_family: FamilyRole.MEMBER,
            updated_at: Timestamp.now(),
        });

        // Marca convite como aceito
        await updateDoc(invitationRef, {
            status: InvitationStatus.ACCEPTED,
            accepted_at: Timestamp.now(),
            accepted_by: userId,
        });

        // ============================================
        // APLICAR PERMISSÕES
        // ============================================
        const permissions = invitation.permissions;
        if (permissions) {
            // 1. Cartões: Adiciona usuário em shared_with_uids e também como membro da subcoleção
            if (permissions.cards && permissions.cards.length > 0) {
                for (const cardId of permissions.cards) {
                    try {
                        // Método 1: shared_with_uids (Novo padrão para busca eficiente)
                        const cardRef = doc(db, "cards", cardId);
                        await updateDoc(cardRef, {
                            shared_with_uids: arrayUnion(userId),
                            updated_at: Timestamp.now()
                        });

                        // Método 2: users_assigned (Mantendo para compatibilidade com UI de membros)
                        // FIX: Priorizar o NOME da pessoa, não o parentesco/role
                        const memberName = invitation.invitee_name || invitation.role_label || "Membro da Família";
                        await addCardMember(cardId, memberName);
                    } catch (err) {
                        console.error(`Erro ao adicionar membro ao cartão ${cardId}:`, err);
                    }
                }
            }

            // 2. Contas: Adiciona userId em shared_with_uids
            if (permissions.accounts && permissions.accounts.length > 0) {
                for (const accountId of permissions.accounts) {
                    try {
                        const accRef = doc(db, "bank_accounts", accountId);
                        await updateDoc(accRef, {
                            is_shared: true,
                            shared_with_uids: arrayUnion(userId),
                            updated_at: Timestamp.now()
                        });
                    } catch (err) {
                        console.error(`Erro ao compartilhar conta ${accountId}:`, err);
                    }
                }
            }

            // 3. Investimentos: Adiciona userId em shared_with_uids e TAMBÉM compartilha a conta atrelada
            if (permissions.investments && permissions.investments.length > 0) {
                for (const invId of permissions.investments) {
                    try {
                        const invRef = doc(db, "investments", invId);
                        const invSnap = await getDoc(invRef);

                        if (invSnap.exists()) {
                            const invData = invSnap.data();

                            // Compartilha o investimento
                            await updateDoc(invRef, {
                                shared_with_uids: arrayUnion(userId),
                                updated_at: Timestamp.now()
                            });

                            // Compartilha a conta (se houver account_id)
                            if (invData.account_id) {
                                const accRef = doc(db, "bank_accounts", invData.account_id);
                                await updateDoc(accRef, {
                                    is_shared: true,
                                    shared_with_uids: arrayUnion(userId),
                                    updated_at: Timestamp.now()
                                });
                            }
                        }
                    } catch (err) {
                        console.error(`Erro ao compartilhar investimento ${invId} ou sua conta:`, err);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Erro ao aceitar convite:", error);
        throw error;
    }
};

/**
 * Rejeita um convite
 */
export const rejectInvitation = async (invitationId: string): Promise<void> => {
    try {
        const invitationRef = doc(db, "family_invitations", invitationId);
        await updateDoc(invitationRef, {
            status: InvitationStatus.REJECTED,
        });
    } catch (error) {
        console.error("Erro ao rejeitar convite:", error);
        throw error;
    }
};

/**
 * Busca convites pendentes de uma família
 */
export const getPendingInvitations = async (
    familyId: string
): Promise<FamilyInvitation[]> => {
    try {
        const q = query(
            collection(db, "family_invitations"),
            where("family_id", "==", familyId),
            where("status", "==", InvitationStatus.PENDING)
        );
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                family_id: data.family_id,
                family_name: data.family_name,
                invited_by: data.invited_by,
                invited_by_name: data.invited_by_name,
                invitation_code: data.invitation_code,
                email: data.email,
                status: data.status as InvitationStatus,
                expires_at: data.expires_at.toDate(),
                created_at: data.created_at.toDate(),
                accepted_at: data.accepted_at?.toDate(),
                accepted_by: data.accepted_by,
            };
        });
    } catch (error) {
        console.error("Erro ao buscar convites pendentes:", error);
        throw error;
    }
};

/**
 * Busca convites recebidos pelo email do usuário
 */
export const getUserPendingInvitations = async (
    email: string
): Promise<FamilyInvitation[]> => {
    try {
        const q = query(
            collection(db, "family_invitations"),
            where("invitee_email", "==", email),
            where("status", "==", InvitationStatus.PENDING)
        );
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                family_id: data.family_id,
                family_name: data.family_name,
                invited_by: data.invited_by,
                invited_by_name: data.invited_by_name,
                invitation_code: data.invitation_code,
                email: data.email,
                status: data.status as InvitationStatus,
                expires_at: data.expires_at.toDate(),
                created_at: data.created_at.toDate(),
                accepted_at: data.accepted_at?.toDate(),
                accepted_by: data.accepted_by,
            };
        });
    } catch (error) {
        console.error("Erro ao buscar convites recebidos:", error);
        throw error;
    }
};

/**
 * Remove um membro da família
 */
export const removeFromFamily = async (
    familyId: string,
    userId: string
): Promise<void> => {
    try {
        // Remove da lista de membros
        const familyRef = doc(db, "families", familyId);
        await updateDoc(familyRef, {
            member_ids: arrayRemove(userId),
            updated_at: Timestamp.now(),
        });

        // Remove família do perfil do usuário
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            family_id: null,
            role_in_family: null,
            updated_at: Timestamp.now(),
        });
    } catch (error) {
        console.error("Erro ao remover da família:", error);
        throw error;
    }
};

/**
 * Cancela um convite pendente
 */
export const cancelInvitation = async (invitationId: string): Promise<void> => {
    try {
        const invitationRef = doc(db, "family_invitations", invitationId);
        await deleteDoc(invitationRef);
    } catch (error) {
        console.error("Erro ao cancelar convite:", error);
        throw error;
    }
};
/**
 * Remove um membro da família e limpa suas permissões
 */
export const removeMember = async (familyId: string, memberId: string): Promise<void> => {
    try {
        // 1. Remove do documento da família
        const familyRef = doc(db, "families", familyId);
        await updateDoc(familyRef, {
            member_ids: arrayRemove(memberId),
            updated_at: Timestamp.now()
        });

        // 2. Limpa o perfil do usuário
        const userRef = doc(db, "users", memberId);
        await updateDoc(userRef, {
            family_id: null,
            role_in_family: null,
            updated_at: Timestamp.now()
        });

        // 3. Limpar acessos compartilhados nos ativos
        const collectionsToCleanup = ["bank_accounts", "cards", "investments"];
        for (const colName of collectionsToCleanup) {
            try {
                const q = query(collection(db, colName), where("shared_with_uids", "array-contains", memberId));
                const snap = await getDocs(q);

                const batch = writeBatch(db);
                snap.docs.forEach(docSnap => {
                    batch.update(docSnap.ref, {
                        shared_with_uids: arrayRemove(memberId),
                        updated_at: Timestamp.now()
                    });
                });
                await batch.commit();
            } catch (err) {
                console.error(`Erro ao limpar permissões em ${colName}:`, err);
            }
        }
    } catch (error) {
        console.error("Erro ao remover membro:", error);
        throw error;
    }
};

/**
 * Usuário sai da própria família
 */
export const leaveFamily = async (userId: string, familyId: string): Promise<void> => {
    return removeMember(familyId, userId);
}

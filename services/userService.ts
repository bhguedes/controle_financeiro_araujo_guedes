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
    setDoc,
    Timestamp,
} from "firebase/firestore";
import { UserProfile, FamilyRole } from "@/types";

// ============================================
// FUNÇÕES DE PERFIL DE USUÁRIO
// ============================================

/**
 * Cria ou atualiza o perfil do usuário no Firestore
 */
export const createOrUpdateUserProfile = async (
    uid: string,
    email: string,
    nome?: string
): Promise<void> => {
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // Cria novo perfil
            await setDoc(userRef, {
                uid,
                email,
                nome: nome || email.split("@")[0], // Usa parte do email como nome padrão
                created_at: Timestamp.now(),
                updated_at: Timestamp.now(),
            });
        } else {
            // Atualiza email se mudou
            await updateDoc(userRef, {
                email,
                updated_at: Timestamp.now(),
            });
        }
    } catch (error) {
        console.error("Erro ao criar/atualizar perfil:", error);
        throw error;
    }
};

/**
 * Busca o perfil completo do usuário
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            return null;
        }

        const data = userSnap.data();
        return {
            uid: data.uid,
            email: data.email,
            nome: data.nome,
            telefone: data.telefone,
            photoURL: data.photoURL,
            family_id: data.family_id,
            role_in_family: data.role_in_family as FamilyRole,
            created_at: data.created_at.toDate(),
            updated_at: data.updated_at.toDate(),
        };
    } catch (error) {
        console.error("Erro ao buscar perfil:", error);
        throw error;
    }
};

/**
 * Atualiza informações do perfil do usuário
 */
export const updateUserProfile = async (
    uid: string,
    updates: {
        nome?: string;
        telefone?: string;
        photoURL?: string;
    }
): Promise<void> => {
    try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, {
            ...updates,
            updated_at: Timestamp.now(),
        });
    } catch (error) {
        console.error("Erro ao atualizar perfil:", error);
        throw error;
    }
};

/**
 * Busca todos os usuários de uma família
 */
export const getUsersByFamily = async (familyId: string): Promise<UserProfile[]> => {
    try {
        const q = query(
            collection(db, "users"),
            where("family_id", "==", familyId)
        );
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                uid: data.uid,
                email: data.email,
                nome: data.nome,
                telefone: data.telefone,
                photoURL: data.photoURL,
                family_id: data.family_id,
                role_in_family: data.role_in_family as FamilyRole,
                created_at: data.created_at.toDate(),
                updated_at: data.updated_at.toDate(),
            };
        });
    } catch (error) {
        console.error("Erro ao buscar usuários da família:", error);
        throw error;
    }
};

/**
 * Busca múltiplos perfis de usuário por IDs
 */
export const getUserProfiles = async (uids: string[]): Promise<UserProfile[]> => {
    try {
        const profiles: UserProfile[] = [];

        for (const uid of uids) {
            const profile = await getUserProfile(uid);
            if (profile) {
                profiles.push(profile);
            }
        }

        return profiles;
    } catch (error) {
        console.error("Erro ao buscar perfis:", error);
        throw error;
    }
};

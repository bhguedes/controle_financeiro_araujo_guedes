"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getInvitationByCode, acceptInvitation, rejectInvitation } from "@/services/familyService";
import { Button } from "@/components/ui/button";
import { FamilyInvitation, InvitationStatus } from "@/types";
import { Users, Check, X } from "lucide-react";

export default function ConvitePage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();

    const [invitation, setInvitation] = useState<FamilyInvitation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        loadInvitation();
    }, [params.code]);

    const loadInvitation = async () => {
        try {
            setLoading(true);
            const code = params.code as string;
            const inv = await getInvitationByCode(code);

            if (!inv) {
                setError("Convite não encontrado");
                return;
            }

            if (inv.status !== InvitationStatus.PENDING) {
                setError("Este convite já foi processado");
                return;
            }

            if (new Date(inv.expires_at) < new Date()) {
                setError("Este convite expirou");
                return;
            }

            setInvitation(inv);
        } catch (error) {
            console.error("Erro ao carregar convite:", error);
            setError("Erro ao carregar convite");
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        if (!user || !invitation) return;

        try {
            await acceptInvitation(invitation.id, user.uid);
            alert("Convite aceito! Você agora faz parte da família.");
            router.push("/configuracoes");
        } catch (error: any) {
            console.error("Erro ao aceitar convite:", error);
            alert(error.message || "Erro ao aceitar convite");
        }
    };

    const handleReject = async () => {
        if (!invitation) return;

        try {
            await rejectInvitation(invitation.id);
            alert("Convite rejeitado");
            router.push("/");
        } catch (error) {
            console.error("Erro ao rejeitar convite:", error);
            alert("Erro ao rejeitar convite");
        }
    };

    if (!user) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-purple-50 to-slate-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-slate-900 mb-4">
                        Faça login para aceitar o convite
                    </h1>
                    <Button onClick={() => router.push("/login")}>
                        Ir para Login
                    </Button>
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-purple-50 to-slate-100 flex items-center justify-center p-4">
                <p className="text-slate-600">Carregando convite...</p>
            </main>
        );
    }

    if (error || !invitation) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-purple-50 to-slate-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">
                        {error}
                    </h1>
                    <Button onClick={() => router.push("/")}>
                        Voltar ao Início
                    </Button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-purple-50 to-slate-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
                <div className="text-center mb-6">
                    <Users className="h-16 w-16 text-purple-600 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                        Convite para Família
                    </h1>
                    <p className="text-slate-600">
                        Você foi convidado para fazer parte de:
                    </p>
                </div>

                <div className="bg-purple-50 rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-purple-900 mb-2">
                        {invitation.family_name}
                    </h2>
                    <p className="text-sm text-purple-700">
                        Convidado por: {invitation.invited_by_name}
                    </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-slate-800 mb-2">
                        Ao aceitar, você poderá:
                    </h3>
                    <ul className="text-sm text-slate-600 space-y-1">
                        <li>✓ Compartilhar cartões de crédito</li>
                        <li>✓ Ver contas bancárias compartilhadas</li>
                        <li>✓ Gerenciar despesas em conjunto</li>
                        <li>✓ Visualizar receitas da família</li>
                    </ul>
                </div>

                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={handleReject}
                        className="flex-1 gap-2"
                    >
                        <X className="h-4 w-4" />
                        Rejeitar
                    </Button>
                    <Button
                        onClick={handleAccept}
                        className="flex-1 gap-2"
                    >
                        <Check className="h-4 w-4" />
                        Aceitar Convite
                    </Button>
                </div>
            </div>
        </main>
    );
}

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getUserProfile, updateUserProfile, createOrUpdateUserProfile } from "@/services/userService";
import { createFamily, createInvitation, getPendingInvitations, cancelInvitation, getFamily } from "@/services/familyService";
import { getUsersByFamily } from "@/services/userService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserProfile, FamilyInvitation, Family } from "@/types";
import { Settings, Users, Copy, Trash2, Check } from "lucide-react";

export default function ConfiguracoesPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [family, setFamily] = useState<Family | null>(null);
    const [familyMembers, setFamilyMembers] = useState<UserProfile[]>([]);
    const [invitations, setInvitations] = useState<FamilyInvitation[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [nome, setNome] = useState("");
    const [telefone, setTelefone] = useState("");
    const [familyName, setFamilyName] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (user) {
            loadData();
        } else {
            setLoading(false);
        }
    }, [user]);

    const loadData = async () => {
        if (!user) return;

        try {
            setLoading(true);

            // Cria ou atualiza perfil
            await createOrUpdateUserProfile(user.uid, user.email || "");

            // Carrega perfil
            const userProfile = await getUserProfile(user.uid);
            setProfile(userProfile);

            if (userProfile) {
                setNome(userProfile.nome);
                setTelefone(userProfile.telefone || "");

                // Carrega família se existir
                if (userProfile.family_id) {
                    const familyData = await getFamily(userProfile.family_id);
                    setFamily(familyData);

                    // Carrega membros
                    const members = await getUsersByFamily(userProfile.family_id);
                    setFamilyMembers(members);

                    // Carrega convites pendentes (só se for owner)
                    if (familyData && familyData.owner_id === user.uid) {
                        const pending = await getPendingInvitations(userProfile.family_id);
                        setInvitations(pending);
                    }
                }
            }
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        try {
            await updateUserProfile(user.uid, { nome, telefone });
            alert("Perfil atualizado com sucesso!");
            loadData();
        } catch (error) {
            console.error("Erro ao atualizar perfil:", error);
            alert("Erro ao atualizar perfil.");
        }
    };

    const handleCreateFamily = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !profile) return;

        try {
            await createFamily(user.uid, profile.nome, familyName);
            alert("Família criada com sucesso!");
            setFamilyName("");
            loadData();
        } catch (error) {
            console.error("Erro ao criar família:", error);
            alert("Erro ao criar família.");
        }
    };

    const handleCreateInvitation = async () => {
        if (!user || !profile || !family) return;

        try {
            const { code } = await createInvitation(
                family.id,
                family.name,
                user.uid,
                profile.nome
            );

            const inviteLink = `${window.location.origin}/convite/${code}`;
            navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);

            alert(`Convite criado! Link copiado: ${inviteLink}`);
            loadData();
        } catch (error) {
            console.error("Erro ao criar convite:", error);
            alert("Erro ao criar convite.");
        }
    };

    const handleCancelInvitation = async (invitationId: string) => {
        if (!confirm("Tem certeza que deseja cancelar este convite?")) return;

        try {
            await cancelInvitation(invitationId);
            alert("Convite cancelado!");
            loadData();
        } catch (error) {
            console.error("Erro ao cancelar convite:", error);
            alert("Erro ao cancelar convite.");
        }
    };

    if (!user) {
        router.push("/login");
        return null;
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <p className="text-slate-600">Carregando...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                        ⚙️ Configurações
                    </h1>
                    <p className="text-slate-600">
                        Gerencie seu perfil e família
                    </p>
                </div>

                {/* Perfil */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Settings className="h-6 w-6 text-blue-600" />
                        <h2 className="text-2xl font-semibold text-slate-800">
                            Meu Perfil
                        </h2>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={user.email || ""}
                                disabled
                                className="bg-slate-100"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="nome">Nome *</Label>
                            <Input
                                id="nome"
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="telefone">Telefone</Label>
                            <Input
                                id="telefone"
                                value={telefone}
                                onChange={(e) => setTelefone(e.target.value)}
                                placeholder="(00) 00000-0000"
                            />
                        </div>

                        <Button type="submit">Salvar Alterações</Button>
                    </form>
                </div>

                {/* Família */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Users className="h-6 w-6 text-purple-600" />
                        <h2 className="text-2xl font-semibold text-slate-800">
                            Família
                        </h2>
                    </div>

                    {!family ? (
                        <form onSubmit={handleCreateFamily} className="space-y-4">
                            <p className="text-slate-600 text-sm">
                                Crie uma família para compartilhar cartões e contas com outras pessoas.
                            </p>
                            <div className="space-y-2">
                                <Label htmlFor="familyName">Nome da Família *</Label>
                                <Input
                                    id="familyName"
                                    value={familyName}
                                    onChange={(e) => setFamilyName(e.target.value)}
                                    placeholder="Ex: Família Araujo Guedes"
                                    required
                                />
                            </div>
                            <Button type="submit">Criar Família</Button>
                        </form>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold text-lg text-slate-800 mb-2">
                                    {family.name}
                                </h3>
                                <p className="text-sm text-slate-600">
                                    {familyMembers.length} {familyMembers.length === 1 ? "membro" : "membros"}
                                </p>
                            </div>

                            {/* Membros */}
                            <div>
                                <h4 className="font-semibold text-slate-800 mb-3">Membros</h4>
                                <div className="space-y-2">
                                    {familyMembers.map((member) => (
                                        <div
                                            key={member.uid}
                                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                                        >
                                            <div>
                                                <p className="font-medium text-slate-800">{member.nome}</p>
                                                <p className="text-sm text-slate-600">{member.email}</p>
                                            </div>
                                            {member.uid === family.owner_id && (
                                                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                                                    Proprietário
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Convites (só para owner) */}
                            {family.owner_id === user.uid && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold text-slate-800">Convites</h4>
                                        <Button
                                            onClick={handleCreateInvitation}
                                            size="sm"
                                            className="gap-2"
                                        >
                                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                            {copied ? "Copiado!" : "Novo Convite"}
                                        </Button>
                                    </div>

                                    {invitations.length > 0 ? (
                                        <div className="space-y-2">
                                            {invitations.map((inv) => (
                                                <div
                                                    key={inv.id}
                                                    className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg"
                                                >
                                                    <div>
                                                        <p className="font-mono text-sm font-semibold text-slate-800">
                                                            {inv.invitation_code}
                                                        </p>
                                                        <p className="text-xs text-slate-600">
                                                            Expira em {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleCancelInvitation(inv.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-600" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500">Nenhum convite pendente</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

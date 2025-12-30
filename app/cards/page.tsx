"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { addCard, getMyCards, deleteCard } from "@/services/financeService";
import { Card } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { PlusCircle, CreditCard, Trash2, Users, X } from "lucide-react";

export default function CardsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [cards, setCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);

    // Estados do formulário
    const [nomeCartao, setNomeCartao] = useState("");
    const [limite, setLimite] = useState("");
    const [diaFechamento, setDiaFechamento] = useState("");
    const [diaVencimento, setDiaVencimento] = useState("");
    const [members, setMembers] = useState<string[]>([""]);
    const [submitting, setSubmitting] = useState(false);

    // Carrega os cartões ao montar o componente
    useEffect(() => {
        if (user) {
            loadCards();
        }
    }, [user]);

    const loadCards = async () => {
        if (!user) return;

        try {
            setLoading(true);
            const myCards = await getMyCards(user.uid);
            setCards(myCards);
        } catch (error) {
            console.error("Erro ao carregar cartões:", error);
            alert("Erro ao carregar cartões. Verifique o console.");
        } finally {
            setLoading(false);
        }
    };

    const handleAddMember = () => {
        setMembers([...members, ""]);
    };

    const handleRemoveMember = (index: number) => {
        const newMembers = members.filter((_, i) => i !== index);
        setMembers(newMembers);
    };

    const handleMemberChange = (index: number, value: string) => {
        const newMembers = [...members];
        newMembers[index] = value;
        setMembers(newMembers);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user) {
            alert("Você precisa estar logado para cadastrar um cartão.");
            return;
        }

        // Validações
        if (!nomeCartao.trim()) {
            alert("Nome do cartão é obrigatório.");
            return;
        }

        if (!limite || parseFloat(limite) <= 0) {
            alert("Limite deve ser maior que zero.");
            return;
        }

        const diaFech = parseInt(diaFechamento);
        const diaVenc = parseInt(diaVencimento);

        if (diaFech < 1 || diaFech > 31) {
            alert("Dia de fechamento deve estar entre 1 e 31.");
            return;
        }

        if (diaVenc < 1 || diaVenc > 31) {
            alert("Dia de vencimento deve estar entre 1 e 31.");
            return;
        }

        // Filtra membros vazios
        const validMembers = members.filter((m) => m.trim() !== "");

        // if (validMembers.length === 0) {
        //     alert("Adicione pelo menos um membro ao cartão.");
        //     return;
        // }

        try {
            setSubmitting(true);

            await addCard(
                user.uid,
                {
                    nome_cartao: nomeCartao,
                    limite: parseFloat(limite),
                    dia_fechamento: diaFech,
                    dia_vencimento: diaVenc,
                },
                validMembers
            );

            // Reseta o formulário
            setNomeCartao("");
            setLimite("");
            setDiaFechamento("");
            setDiaVencimento("");
            setMembers([""]);
            setOpen(false);

            // Recarrega os cartões
            await loadCards();

            alert("Cartão cadastrado com sucesso!");
        } catch (error) {
            console.error("Erro ao cadastrar cartão:", error);
            alert("Erro ao cadastrar cartão. Verifique o console.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteCard = async (cardId: string, cardName: string) => {
        if (!confirm(`Tem certeza que deseja excluir o cartão "${cardName}"?`)) {
            return;
        }

        try {
            await deleteCard(cardId);
            await loadCards();
            alert("Cartão excluído com sucesso!");
        } catch (error) {
            console.error("Erro ao excluir cartão:", error);
            alert("Erro ao excluir cartão. Verifique o console.");
        }
    };

    if (!user) {
        router.push("/login");
        return null;
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-900 mb-2">
                            💳 Meus Cartões
                        </h1>
                        <p className="text-slate-600">
                            Gerencie seus cartões de crédito e membros vinculados
                        </p>
                    </div>

                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <PlusCircle className="h-5 w-5" />
                                Novo Cartão
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Cadastrar Novo Cartão</DialogTitle>
                                <DialogDescription>
                                    Preencha os dados do cartão e adicione os membros que podem
                                    utilizá-lo.
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Nome do Cartão */}
                                <div className="space-y-2">
                                    <Label htmlFor="nome_cartao">Nome do Cartão *</Label>
                                    <Input
                                        id="nome_cartao"
                                        placeholder="Ex: Nubank, Itaú Platinum"
                                        value={nomeCartao}
                                        onChange={(e) => setNomeCartao(e.target.value)}
                                        required
                                    />
                                </div>

                                {/* Limite */}
                                <div className="space-y-2">
                                    <Label htmlFor="limite">Limite (R$) *</Label>
                                    <Input
                                        id="limite"
                                        type="number"
                                        step="0.01"
                                        placeholder="0,00"
                                        value={limite}
                                        onChange={(e) => setLimite(e.target.value)}
                                        required
                                    />
                                </div>

                                {/* Dia de Fechamento */}
                                <div className="space-y-2">
                                    <Label htmlFor="dia_fechamento">Dia de Fechamento *</Label>
                                    <Input
                                        id="dia_fechamento"
                                        type="number"
                                        min="1"
                                        max="31"
                                        placeholder="Ex: 15"
                                        value={diaFechamento}
                                        onChange={(e) => setDiaFechamento(e.target.value)}
                                        required
                                    />
                                    <p className="text-xs text-slate-500">
                                        Dia do mês em que a fatura fecha (1-31)
                                    </p>
                                </div>

                                {/* Dia de Vencimento */}
                                <div className="space-y-2">
                                    <Label htmlFor="dia_vencimento">Dia de Vencimento *</Label>
                                    <Input
                                        id="dia_vencimento"
                                        type="number"
                                        min="1"
                                        max="31"
                                        placeholder="Ex: 25"
                                        value={diaVencimento}
                                        onChange={(e) => setDiaVencimento(e.target.value)}
                                        required
                                    />
                                    <p className="text-xs text-slate-500">
                                        Dia do mês em que a fatura vence (1-31)
                                    </p>
                                </div>

                                {/* Membros */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label>Membros do Cartão *</Label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleAddMember}
                                            className="gap-1"
                                        >
                                            <PlusCircle className="h-4 w-4" />
                                            Adicionar Membro
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        {members.map((member, index) => (
                                            <div key={index} className="flex gap-2">
                                                <Input
                                                    placeholder={`Ex: ${index === 0
                                                        ? "Esposa"
                                                        : index === 1
                                                            ? "Marido"
                                                            : `Membro ${index + 1}`
                                                        }`}
                                                    value={member}
                                                    onChange={(e) =>
                                                        handleMemberChange(index, e.target.value)
                                                    }
                                                />
                                                {members.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveMember(index)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <p className="text-xs text-slate-500">
                                        Adicione os nomes das pessoas que podem usar este cartão
                                    </p>
                                </div>

                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setOpen(false)}
                                        disabled={submitting}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={submitting}>
                                        {submitting ? "Salvando..." : "Salvar Cartão"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Lista de Cartões */}
                {loading ? (
                    <div className="text-center py-12">
                        <p className="text-slate-600">Carregando cartões...</p>
                    </div>
                ) : cards.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                        <CreditCard className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-slate-800 mb-2">
                            Nenhum cartão cadastrado
                        </h3>
                        <p className="text-slate-600 mb-6">
                            Comece cadastrando seu primeiro cartão de crédito
                        </p>
                        <Button onClick={() => setOpen(true)} className="gap-2">
                            <PlusCircle className="h-5 w-5" />
                            Cadastrar Primeiro Cartão
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {cards.map((card) => (
                            <div
                                key={card.id}
                                onClick={() => router.push(`/cards/${card.id}`)}
                                className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer relative group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="h-6 w-6 text-blue-600" />
                                        <h3 className="text-xl font-bold text-slate-900">
                                            {card.nome_cartao}
                                        </h3>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteCard(card.id, card.nome_cartao);
                                        }}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Limite:</span>
                                        <span className="font-semibold text-slate-900">
                                            R$ {card.limite.toLocaleString("pt-BR")}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Fechamento:</span>
                                        <span className="font-semibold text-slate-900">
                                            Dia {card.dia_fechamento}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Vencimento:</span>
                                        <span className="font-semibold text-slate-900">
                                            Dia {card.dia_vencimento}
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users className="h-4 w-4 text-slate-600" />
                                        <span className="text-sm font-semibold text-slate-700">
                                            Membros ({card.users_assigned.length})
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {card.users_assigned.map((user) => (
                                            <span
                                                key={user.id}
                                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                            >
                                                {user.nome}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}

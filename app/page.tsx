"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getMyCards, addTransaction } from "@/services/financeService";
import { NewExpenseForm } from "@/components/NewExpenseForm";
import { Card, TransactionFormData } from "@/types";
import { Button } from "@/components/ui/button";
import { CreditCard, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
    const { user } = useAuth();
    const router = useRouter();
    const [cards, setCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            loadCards();
        } else {
            setLoading(false);
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
        } finally {
            setLoading(false);
        }
    };

    const handleNewExpense = async (
        data: TransactionFormData & { mes_fatura?: string }
    ) => {
        if (!user) {
            alert("Você precisa estar logado para cadastrar uma despesa.");
            return;
        }

        try {
            await addTransaction(user.uid, {
                descricao: data.descricao,
                valor: data.valor,
                categoria: data.categoria,
                data: data.data,
                tipo: data.tipo,
                metodo_pagamento: data.metodo_pagamento,
                card_id: data.card_id,
                user_id_gasto: data.user_id_gasto,
                mes_fatura: data.mes_fatura,
            });

            // Adiciona à lista local para exibição imediata
            setTransactions((prev) => [
                ...prev,
                { ...data, id: Date.now().toString() },
            ]);

            alert("Despesa cadastrada com sucesso!");
        } catch (error) {
            console.error("Erro ao cadastrar despesa:", error);
            alert("Erro ao cadastrar despesa. Verifique o console.");
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
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-slate-900 mb-2">
                        💰 Controle Financeiro Familiar
                    </h1>
                    <p className="text-slate-600">
                        Bem-vindo, {user.email}! Gerencie suas finanças de forma inteligente.
                    </p>
                </div>

                {/* Cards de Ação Rápida */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <CreditCard className="h-8 w-8 text-blue-600" />
                            <h2 className="text-2xl font-semibold text-slate-800">
                                Meus Cartões
                            </h2>
                        </div>
                        <p className="text-slate-600 mb-4">
                            {loading
                                ? "Carregando..."
                                : `Você tem ${cards.length} ${cards.length === 1 ? "cartão cadastrado" : "cartões cadastrados"
                                }`}
                        </p>
                        <Link href="/cards">
                            <Button className="w-full gap-2">
                                <CreditCard className="h-4 w-4" />
                                Gerenciar Cartões
                            </Button>
                        </Link>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <PlusCircle className="h-8 w-8 text-green-600" />
                            <h2 className="text-2xl font-semibold text-slate-800">
                                Nova Despesa
                            </h2>
                        </div>
                        <p className="text-slate-600 mb-4">
                            Cadastre uma nova saída de forma rápida e inteligente
                        </p>
                        {cards.length > 0 ? (
                            <NewExpenseForm cards={cards} onSubmit={handleNewExpense} />
                        ) : (
                            <div className="text-sm text-slate-500">
                                Cadastre um cartão primeiro para registrar despesas
                            </div>
                        )}
                    </div>
                </div>

                {/* Informações sobre Cartões */}
                {!loading && cards.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                        <h2 className="text-2xl font-semibold text-slate-800 mb-4">
                            📊 Seus Cartões
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {cards.map((card) => (
                                <div
                                    key={card.id}
                                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                >
                                    <h4 className="font-semibold text-slate-800">
                                        {card.nome_cartao}
                                    </h4>
                                    <p className="text-sm text-slate-600 mt-1">
                                        Limite: R$ {card.limite.toLocaleString("pt-BR")}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Membros: {card.users_assigned.map((u) => u.nome).join(", ")}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Fecha dia {card.dia_fechamento} | Vence dia{" "}
                                        {card.dia_vencimento}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Lista de Transações */}
                {transactions.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-8">
                        <h2 className="text-2xl font-semibold text-slate-800 mb-4">
                            📋 Últimas Transações
                        </h2>
                        <div className="space-y-3">
                            {transactions.map((transaction) => (
                                <div
                                    key={transaction.id}
                                    className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-semibold text-slate-800">
                                                {transaction.descricao}
                                            </h4>
                                            <p className="text-sm text-slate-600 mt-1">
                                                {transaction.categoria} • {transaction.tipo}
                                            </p>
                                            {transaction.mes_fatura && (
                                                <p className="text-xs text-blue-600 mt-1">
                                                    📅 Fatura: {transaction.mes_fatura}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg text-slate-900">
                                                R${" "}
                                                {transaction.valor.toLocaleString("pt-BR", {
                                                    minimumFractionDigits: 2,
                                                })}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {new Date(transaction.data).toLocaleDateString("pt-BR")}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

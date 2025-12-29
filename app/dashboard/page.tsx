"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
    getMyCards,
    addTransaction,
    getMyTransactions,
} from "@/services/financeService";
import { NewExpenseForm } from "@/components/NewExpenseForm";
import { Card, Transaction, TransactionFormData } from "@/types";
import { Button } from "@/components/ui/button";
import {
    CreditCard,
    TrendingUp,
    TrendingDown,
    Wallet,
    PlusCircle,
} from "lucide-react";
import Link from "next/link";
import { obterMesAtual } from "@/lib/invoiceUtils";

export default function DashboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [cards, setCards] = useState<Card[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadData();
        } else {
            router.push("/login");
        }
    }, [user]);

    const loadData = async () => {
        if (!user) return;

        try {
            setLoading(true);
            const [myCards, myTransactions] = await Promise.all([
                getMyCards(user.uid),
                getMyTransactions(user.uid),
            ]);

            setCards(myCards);
            setTransactions(myTransactions);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
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

            // Recarrega os dados
            await loadData();

            alert("Despesa cadastrada com sucesso!");
        } catch (error) {
            console.error("Erro ao cadastrar despesa:", error);
            alert("Erro ao cadastrar despesa. Verifique o console.");
        }
    };

    // Cálculos do mês atual
    const mesAtual = obterMesAtual();

    const totalRendas = transactions
        .filter((t) => t.tipo === "RENDA")
        .reduce((sum, t) => sum + t.valor, 0);

    const totalContasFixas = transactions
        .filter((t) => t.tipo === "CONTA_FIXA")
        .reduce((sum, t) => sum + t.valor, 0);

    const totalFaturasCartoes = transactions
        .filter(
            (t) =>
                t.metodo_pagamento === "CARTAO_CREDITO" && t.mes_fatura === mesAtual
        )
        .reduce((sum, t) => sum + t.valor, 0);

    const saldo = totalRendas - totalContasFixas - totalFaturasCartoes;

    if (!user) {
        return null;
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center py-12">
                        <p className="text-slate-600">Carregando dashboard...</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-900 mb-2">
                            📊 Dashboard Financeiro
                        </h1>
                        <p className="text-slate-600">
                            Visão geral das suas finanças - {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                        </p>
                    </div>

                    {/* Botão Nova Saída */}
                    {cards.length > 0 ? (
                        <NewExpenseForm
                            cards={cards}
                            onSubmit={handleNewExpense}
                            trigger={
                                <Button size="lg" className="gap-2">
                                    <PlusCircle className="h-5 w-5" />
                                    Nova Saída
                                </Button>
                            }
                        />
                    ) : (
                        <Link href="/cards">
                            <Button size="lg" className="gap-2">
                                <CreditCard className="h-5 w-5" />
                                Cadastrar Cartão
                            </Button>
                        </Link>
                    )}
                </div>

                {/* Cards de Resumo */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Total de Rendas */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-slate-600">
                                Total de Rendas
                            </h3>
                            <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <p className="text-3xl font-bold text-slate-900">
                            R$ {totalRendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            {transactions.filter((t) => t.tipo === "RENDA").length} transações
                        </p>
                    </div>

                    {/* Contas Fixas */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-slate-600">
                                Contas Fixas
                            </h3>
                            <TrendingDown className="h-5 w-5 text-orange-600" />
                        </div>
                        <p className="text-3xl font-bold text-slate-900">
                            R$ {totalContasFixas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            {transactions.filter((t) => t.tipo === "CONTA_FIXA").length} contas
                        </p>
                    </div>

                    {/* Faturas de Cartões */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-slate-600">
                                Faturas do Mês
                            </h3>
                            <CreditCard className="h-5 w-5 text-blue-600" />
                        </div>
                        <p className="text-3xl font-bold text-slate-900">
                            R$ {totalFaturasCartoes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            {cards.length} {cards.length === 1 ? "cartão" : "cartões"}
                        </p>
                    </div>

                    {/* Saldo */}
                    <div className={`bg-white rounded-xl shadow-lg p-6 border-l-4 ${saldo >= 0 ? "border-emerald-500" : "border-red-500"}`}>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-slate-600">
                                Saldo do Mês
                            </h3>
                            <Wallet className={`h-5 w-5 ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`} />
                        </div>
                        <p className={`text-3xl font-bold ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            R$ {Math.abs(saldo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            {saldo >= 0 ? "Positivo" : "Negativo"}
                        </p>
                    </div>
                </div>

                {/* Seção de Cartões */}
                {cards.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-semibold text-slate-800">
                                💳 Seus Cartões
                            </h2>
                            <Link href="/cards">
                                <Button variant="outline" size="sm">
                                    Gerenciar
                                </Button>
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {cards.map((card) => {
                                const faturaMes = transactions
                                    .filter(
                                        (t) =>
                                            t.card_id === card.id && t.mes_fatura === mesAtual
                                    )
                                    .reduce((sum, t) => sum + t.valor, 0);

                                const percentualUsado = (faturaMes / card.limite) * 100;

                                return (
                                    <div
                                        key={card.id}
                                        className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <CreditCard className="h-5 w-5 text-blue-600" />
                                            <h4 className="font-semibold text-slate-800">
                                                {card.nome_cartao}
                                            </h4>
                                        </div>

                                        <div className="space-y-2 mb-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Fatura atual:</span>
                                                <span className="font-semibold text-slate-900">
                                                    R$ {faturaMes.toLocaleString("pt-BR")}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-600">Limite:</span>
                                                <span className="font-semibold text-slate-900">
                                                    R$ {card.limite.toLocaleString("pt-BR")}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Barra de Progresso */}
                                        <div className="mb-2">
                                            <div className="flex justify-between text-xs text-slate-600 mb-1">
                                                <span>Uso do limite</span>
                                                <span>{percentualUsado.toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${percentualUsado > 80
                                                            ? "bg-red-500"
                                                            : percentualUsado > 50
                                                                ? "bg-orange-500"
                                                                : "bg-green-500"
                                                        }`}
                                                    style={{ width: `${Math.min(percentualUsado, 100)}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="text-xs text-slate-500 mt-3">
                                            Membros: {card.users_assigned.map((u) => u.nome).join(", ")}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Últimas Transações */}
                {transactions.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-8">
                        <h2 className="text-2xl font-semibold text-slate-800 mb-6">
                            📋 Últimas Transações
                        </h2>

                        <div className="space-y-3">
                            {transactions.slice(0, 10).map((transaction) => (
                                <div
                                    key={transaction.id}
                                    className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-slate-800">
                                                {transaction.descricao}
                                            </h4>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                                                    {transaction.tipo}
                                                </span>
                                                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                                                    {transaction.categoria}
                                                </span>
                                                {transaction.mes_fatura && (
                                                    <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                                                        Fatura: {transaction.mes_fatura}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right ml-4">
                                            <p
                                                className={`font-bold text-lg ${transaction.tipo === "RENDA"
                                                        ? "text-green-600"
                                                        : "text-red-600"
                                                    }`}
                                            >
                                                {transaction.tipo === "RENDA" ? "+" : "-"}R${" "}
                                                {transaction.valor.toLocaleString("pt-BR", {
                                                    minimumFractionDigits: 2,
                                                })}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {transaction.data.toLocaleDateString("pt-BR")}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Estado Vazio */}
                {cards.length === 0 && (
                    <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                        <CreditCard className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-slate-800 mb-2">
                            Comece cadastrando um cartão
                        </h3>
                        <p className="text-slate-600 mb-6">
                            Cadastre seu primeiro cartão de crédito para começar a gerenciar
                            suas finanças
                        </p>
                        <Link href="/cards">
                            <Button className="gap-2">
                                <PlusCircle className="h-5 w-5" />
                                Cadastrar Primeiro Cartão
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}

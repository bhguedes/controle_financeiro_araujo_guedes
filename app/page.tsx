"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getMyCards, addTransaction } from "@/services/financeService";
import { getMyAccounts } from "@/services/accountService";
import { NewExpenseForm } from "@/components/NewExpenseForm";
import { Card, BankAccount, TransactionFormData } from "@/types";
import { Button } from "@/components/ui/button";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUserProfile } from "@/services/userService";
import { CreditCard, PlusCircle, Wallet, Leaf } from "lucide-react";

export default function Home() {
    const { user } = useAuth();
    const router = useRouter();
    const [cards, setCards] = useState<Card[]>([]);
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [userName, setUserName] = useState<string>("");

    useEffect(() => {
        if (user) {
            loadCards();
            loadAccounts();
            loadProfile();
        } else {
            setLoading(false);
        }
    }, [user]);

    const loadProfile = async () => {
        if (!user) return;
        try {
            const profile = await getUserProfile(user.uid);
            if (profile?.nome) {
                setUserName(profile.nome);
            } else if (user.displayName) {
                setUserName(user.displayName);
            }
        } catch (error) {
            console.error("Erro ao carregar perfil:", error);
        }
    };

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

    const loadAccounts = async () => {
        if (!user) return;
        try {
            const myAccounts = await getMyAccounts(user.uid);
            setAccounts(myAccounts);
        } catch (error) {
            console.error("Erro ao carregar contas:", error);
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
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-emerald-100 p-2 rounded-lg">
                            <Leaf className="h-8 w-8 text-emerald-600" />
                        </div>
                        <h1 className="text-4xl font-bold text-slate-900">
                            Poupa+
                        </h1>
                    </div>
                    <p className="text-slate-600 text-lg">
                        Bem-vindo, <span className="font-semibold text-emerald-700">{userName || user.email}</span>! Gerencie suas finanças de forma inteligente.
                    </p>
                </div>

                {/* Cards de Ação Rápida */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Meus Cartões */}
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

                    {/* Acesso as Contas */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Wallet className="h-8 w-8 text-emerald-600" />
                            <h2 className="text-2xl font-semibold text-slate-800">
                                Contas Bancárias
                            </h2>
                        </div>
                        <p className="text-slate-600 mb-4">
                            {loading
                                ? "Carregando..."
                                : `Você tem ${accounts.length} ${accounts.length === 1 ? "conta cadastrada" : "contas cadastradas"
                                }`}
                        </p>
                        <Link href="/contas">
                            <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
                                <Wallet className="h-4 w-4" />
                                Acessar Contas
                            </Button>
                        </Link>
                    </div>

                    {/* Nova Despesa */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <PlusCircle className="h-8 w-8 text-red-600" />
                            <h2 className="text-2xl font-semibold text-slate-800">
                                Nova Despesa
                            </h2>
                        </div>
                        <p className="text-slate-600 mb-4">
                            Cadastre uma despesa rápida
                        </p>
                        {cards.length > 0 || accounts.length > 0 ? (
                            <NewExpenseForm cards={cards} accounts={accounts} onSubmit={handleNewExpense} />
                        ) : (
                            <div className="text-sm text-slate-500">
                                Cadastre um cartão primeiro
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}

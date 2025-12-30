"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getMyTransactions, addTransaction, updateTransaction, deleteTransaction } from "@/services/financeService";
import { getMyCards } from "@/services/financeService";
import { getMyAccounts } from "@/services/accountService";
import { NewExpenseForm } from "@/components/NewExpenseForm";
import { Card, BankAccount, Transaction, TransactionType, TransactionStatus, TransactionFormData, CategoryLabels, PaymentMethodLabels } from "@/types";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Pencil, Trash2, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DespesasPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [cards, setCards] = useState<Card[]>([]);
    const [accounts, setAccounts] = useState<BankAccount[]>([]);

    // State for Editing
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

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
            const [myCards, myAccounts, myTransactions] = await Promise.all([
                getMyCards(user.uid),
                getMyAccounts(user.uid),
                getMyTransactions(user.uid)
            ]);

            setCards(myCards);
            setAccounts(myAccounts);

            // Filter expenses and sort by date desc
            const expenses = myTransactions
                .filter(t => t.tipo !== TransactionType.RENDA)
                .sort((a, b) => b.data.getTime() - a.data.getTime());

            setTransactions(expenses);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleNewExpense = async (data: TransactionFormData) => {
        if (!user) return;
        try {
            await addTransaction(user.uid, {
                ...data,
                status: TransactionStatus.COMPLETED // Default is completed
            });
            loadData();
            alert("Despesa adicionada!");
        } catch (error) {
            console.error(error);
            alert("Erro ao adicionar despesa.");
        }
    };

    const handleEditSubmit = async (data: TransactionFormData) => {
        if (!editingTransaction) return;
        try {
            await updateTransaction(editingTransaction.id, data);
            setEditingTransaction(null);
            loadData();
            alert("Despesa atualizada!");
        } catch (error) {
            console.error("Erro ao atualizar despesa:", error);
            alert("Erro ao atualizar despesa.");
        }
    };

    const handleDelete = async (t: Transaction) => {
        if (!confirm(`Tem certeza que deseja excluir "${t.descricao}"?`)) return;
        try {
            await deleteTransaction(t.id);
            loadData();
            alert("Despesa excluída!");
        } catch (error) {
            console.error("Erro ao excluir despesa:", error);
            alert("Erro ao excluir despesa.");
        }
    };

    const handleConfirmTransaction = async (transaction: Transaction) => {
        if (!confirm(`Confirmar o pagamento de "${transaction.descricao}"?`)) return;
        try {
            await updateTransaction(transaction.id, {
                status: TransactionStatus.COMPLETED,
                updated_at: new Date()
            });

            alert("Despesa confirmada!");
            loadData();
        } catch (error) {
            console.error(error);
            alert("Erro ao confirmar.");
        }
    };

    if (!user) {
        router.push("/login");
        return null;
    }

    const pendingTransactions = transactions.filter(t => t.status === TransactionStatus.PENDING);
    const completedTransactions = transactions.filter(t => t.status !== TransactionStatus.PENDING);

    return (
        <main className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Despesas</h1>
                        <p className="text-slate-600">Gerencie suas saídas e pagamentos</p>
                    </div>

                    {/* Botão Nova Despesa (usando o componente refatorado) */}
                    <NewExpenseForm
                        cards={cards}
                        accounts={accounts}
                        onSubmit={handleNewExpense}
                        trigger={
                            <Button className="gap-2 bg-red-600 hover:bg-red-700">
                                <PlusCircle className="h-4 w-4" />
                                Nova Despesa
                            </Button>
                        }
                    />
                </div>

                {/* Pendentes */}
                {pendingTransactions.length > 0 && (
                    <div className="mb-8 p-4 bg-orange-50 rounded-xl border border-orange-100">
                        <h2 className="text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Pendentes de Confirmação
                        </h2>
                        <div className="space-y-3">
                            {pendingTransactions.map(t => (
                                <div key={t.id} className="bg-white p-4 rounded-lg shadow-sm border border-orange-200 flex justify-between items-center">
                                    <div>
                                        <p className="font-medium text-slate-900">{t.descricao}</p>
                                        <p className="text-sm text-slate-500">
                                            {format(t.data, "dd 'de' MMMM", { locale: ptBR })} • {CategoryLabels[t.categoria]}
                                        </p>
                                        <p className="font-bold text-slate-900 mt-1">
                                            R$ {t.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => setEditingTransaction(t)}
                                            className="text-slate-400 hover:text-blue-600"
                                            title="Editar"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDelete(t)}
                                            className="text-slate-400 hover:text-red-600"
                                            title="Excluir"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-700 ml-2"
                                            onClick={() => handleConfirmTransaction(t)}
                                        >
                                            <CheckCircle2 className="h-4 w-4 mr-1" />
                                            Confirmar
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Histórico */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-slate-800">Histórico</h2>
                    {loading ? (
                        <p>Carregando...</p>
                    ) : completedTransactions.length === 0 ? (
                        <p className="text-slate-500">Nenhuma despesa registrada.</p>
                    ) : (
                        completedTransactions.map(t => (
                            <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center group">
                                <div className="flex-1">
                                    <p className="font-medium text-slate-900">{t.descricao}</p>
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <span>{format(t.data, "dd/MM/yyyy", { locale: ptBR })}</span>
                                        <span>•</span>
                                        <span>{CategoryLabels[t.categoria]}</span>
                                        {t.parcelado && (
                                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 flex items-center">
                                                {t.parcela_atual}/{t.numero_parcelas}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right flex items-center gap-4">
                                    <div>
                                        <p className="font-bold text-red-600">
                                            - R$ {t.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {PaymentMethodLabels[t.metodo_pagamento]}
                                        </p>
                                    </div>

                                    {/* Ações (aparecem ao passar o mouse ou mobile) */}
                                    <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => setEditingTransaction(t)}
                                            className="h-8 w-8 text-slate-400 hover:text-blue-600"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDelete(t)}
                                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Dialogo de Edição */}
                <NewExpenseForm
                    open={!!editingTransaction}
                    onOpenChange={(open) => {
                        if (!open) setEditingTransaction(null);
                    }}
                    cards={cards}
                    accounts={accounts}
                    onSubmit={handleEditSubmit}
                    initialData={editingTransaction || undefined}
                    trigger={null}
                />
            </div>
        </main>
    );
}

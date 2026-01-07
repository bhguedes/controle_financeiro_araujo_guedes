"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getMyTransactions, addTransaction, updateTransaction, deleteTransaction, processRecurringExpenses } from "@/services/financeService";
import { getMyCards } from "@/services/financeService";
import { getMyAccounts } from "@/services/accountService";
import { NewExpenseForm } from "@/components/NewExpenseForm";
import { Card, BankAccount, Transaction, TransactionType, TransactionStatus, TransactionFormData, CategoryLabels, PaymentMethodLabels } from "@/types";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Pencil, Trash2, PlusCircle, Filter, Users, CreditCard } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CsvImporter } from "@/components/CsvImporter";

export default function DespesasPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [cards, setCards] = useState<Card[]>([]);
    const [accounts, setAccounts] = useState<BankAccount[]>([]);

    // State for Editing
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    // Filters
    const [filterCard, setFilterCard] = useState<string>("all");
    const [filterMember, setFilterMember] = useState<string>("all");

    // View State
    const [viewMode, setViewMode] = useState<'monthly' | 'history'>('monthly');
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        if (user) {
            loadData();
        } else {
            setLoading(false);
        }
    }, [user, selectedDate]);

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

            // Process Recurring Expenses (Fixed Accounts) for the selected month to ensure they appear
            await processRecurringExpenses(user.uid, selectedDate);

            // Store ALL transactions raw, we filter in render time based on viewMode
            // Sort by date desc
            const sorted = myTransactions.sort((a, b) => b.data.getTime() - a.data.getTime());
            setTransactions(sorted);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrevMonth = () => {
        setSelectedDate(d => addMonths(d, -1));
    };

    const handleNextMonth = () => {
        setSelectedDate(d => addMonths(d, 1));
    };

    const getInstallmentInfo = (t: Transaction) => {
        if (!t.parcelado || !t.numero_parcelas) return "";
        const now = new Date();
        const start = t.data;
        const diffMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
        let current = diffMonths + 1;
        if (current < 1) current = 1;
        if (current > t.numero_parcelas) current = t.numero_parcelas;
        return `${current}/${t.numero_parcelas}`;
    };

    const handleNewExpense = async (data: TransactionFormData) => {
        if (!user) return;
        try {
            await addTransaction(user.uid, {
                ...data,
                tipo: TransactionType.VARIAVEL, // Default to variable, form might override? No, form provides category etc.
                // expense form usually implies expense.
                status: TransactionStatus.COMPLETED // Default to completed unless specified
            });
            loadData();
        } catch (error) {
            console.error("Error adding expense:", error);
            alert("Erro ao adicionar despesa");
        }
    };

    const handleEditSubmit = async (data: TransactionFormData) => {
        if (!user || !editingTransaction) return;
        try {
            await updateTransaction(editingTransaction.id, data);
            setEditingTransaction(null);
            loadData();
        } catch (error) {
            console.error("Error updating transaction:", error);
            alert("Erro ao atualizar transação");
        }
    };

    const handleDelete = async (t: Transaction) => {
        if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;
        try {
            await deleteTransaction(t.id); // Assuming simple delete. If installment, might ask to delete all.
            loadData();
        } catch (error) {
            console.error("Error deleting transaction:", error);
        }
    };

    const handleConfirmTransaction = async (t: Transaction) => {
        try {
            await updateTransaction(t.id, { status: TransactionStatus.COMPLETED });
            loadData();
        } catch (error) {
            console.error("Error confirming transaction:", error);
        }
    };

    // Filter Logic
    const pendingTransactions = transactions
        .filter(t => t.status === TransactionStatus.PENDING)
        .filter(t => filterCard === "all" || t.card_id === filterCard)
        .filter(t => filterMember === "all" || t.user_id_gasto === filterMember || t.user_id_criador === filterMember);

    // Completed Transactions Logic (Dynamic based on ViewMode)
    let displayedTransactions = transactions
        .filter(t => t.status !== TransactionStatus.PENDING)
        .filter(t => filterCard === "all" || t.card_id === filterCard)
        .filter(t => filterMember === "all" || t.user_id_gasto === filterMember || t.user_id_criador === filterMember);

    if (viewMode === 'monthly') {
        // Filter by selected Main/Year
        displayedTransactions = displayedTransactions.filter(t =>
            t.data.getMonth() === selectedDate.getMonth() &&
            t.data.getFullYear() === selectedDate.getFullYear()
        );
        // Do NOT consolidate installments. Show them as is.
    } else {
        // 'history': Consolidate installments
        const groupedTransactions: { [key: string]: Transaction } = {};
        const singleTransactions: Transaction[] = [];

        displayedTransactions.forEach(t => {
            if (t.parcelado && t.compra_parcelada_id) {
                const existing = groupedTransactions[t.compra_parcelada_id];
                // Try to find the "head" (first installment) to represent the purchase
                // Or simply the earliest one in the dataset? 
                // To represent the purchase in history, ideally we show the FIRST one (1/N).
                // Or if we don't have it (deleted?), the earliest available.
                if (!existing || t.data < existing.data) {
                    groupedTransactions[t.compra_parcelada_id] = t;
                }
            } else {
                singleTransactions.push(t);
            }
        });

        displayedTransactions = [
            ...singleTransactions,
            ...Object.values(groupedTransactions)
        ].sort((a, b) => b.data.getTime() - a.data.getTime());
    }

    return (
        <main className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Despesas</h1>
                        <p className="text-slate-600">Gerencie suas saídas e pagamentos</p>
                    </div>

                    <div className="flex gap-2">
                        <CsvImporter cards={cards} onSuccess={loadData} />

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
                </div>

                {/* Filtros e Controles de Visualização */}
                <div className="flex flex-col md:flex-row gap-4 mb-6 sticky top-0 z-10 bg-slate-50 py-2">
                    {/* Filtros de Cartão/Membro */}
                    <div className="flex gap-2 flex-1">
                        <div className="flex items-center gap-2 bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex-1">
                            <CreditCard className="h-5 w-5 text-slate-400" />
                            <select
                                className="bg-transparent text-sm font-medium text-slate-700 outline-none w-full"
                                value={filterCard}
                                onChange={(e) => setFilterCard(e.target.value)}
                            >
                                <option value="all">Todos os Cartões</option>
                                {cards.map(c => (
                                    <option key={c.id} value={c.id}>{c.nome_cartao}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex-1">
                            <Users className="h-5 w-5 text-slate-400" />
                            <select
                                className="bg-transparent text-sm font-medium text-slate-700 outline-none w-full"
                                value={filterMember}
                                onChange={(e) => setFilterMember(e.target.value)}
                            >
                                <option value="all">Todos os Membros</option>
                                {Array.from(new Map(cards.flatMap(c => c.users_assigned?.map(m => [m.id, m.nome]) || [])).entries()).map(([id, name]) => (
                                    <option key={id} value={id}>{name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Toggle Mode */}
                    <div className="flex bg-white rounded-xl shadow-sm border border-slate-100 p-1">
                        <button
                            onClick={() => setViewMode('monthly')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'monthly' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Mensal
                        </button>
                        <button
                            onClick={() => setViewMode('history')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'history' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Histórico
                        </button>
                    </div>
                </div>

                {/* Navegação de Mês (Apenas no modo Mensal) */}
                {viewMode === 'monthly' && (
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
                        <Button variant="ghost" onClick={handlePrevMonth}>
                            &larr; Anterior
                        </Button>
                        <h2 className="text-lg font-bold text-slate-800 capitalize">
                            {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
                        </h2>
                        <Button variant="ghost" onClick={handleNextMonth}>
                            Próximo &rarr;
                        </Button>
                    </div>
                )}

                {/* Pendentes */}
                {pendingTransactions.length > 0 && (
                    <div className="mb-8 p-4 bg-orange-50 rounded-xl border border-orange-100">
                        {/* ... (Keep pending content unchanged) ... */}
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
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDelete(t)}
                                            className="text-slate-400 hover:text-red-600"
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

                {/* Lista de Transações */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-slate-800">
                            {viewMode === 'monthly' ? `Gastos de ${format(selectedDate, "MMMM", { locale: ptBR })}` : 'Histórico Completo'}
                        </h2>
                        {viewMode === 'monthly' && (
                            <span className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                                Total: R$ {displayedTransactions.reduce((acc, t) => acc + t.valor, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <p>Carregando...</p>
                    ) : displayedTransactions.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-100">
                            <p className="text-slate-500">Nenhuma despesa neste período.</p>
                        </div>
                    ) : (
                        displayedTransactions.map(t => {
                            // Display Logic
                            const isParceladoReview = viewMode === 'history' && t.parcelado && (t.numero_parcelas || 0) > 1;

                            // In History Mode: Show Total Value and "Parcela X/Y" (calculated)
                            // In Monthly Mode: Show Installment Value and "Parcela X/Y" (static from DB)

                            let displayValue = t.valor;
                            let installmentText = null;

                            if (viewMode === 'history') {
                                if (isParceladoReview) {
                                    displayValue = t.valor * (t.numero_parcelas || 1);
                                    installmentText = `Parcela ${getInstallmentInfo(t)}`;
                                }
                            } else {
                                // Monthly Mode
                                if (t.parcelado) {
                                    // Show exact installment
                                    installmentText = `Parcela ${t.parcela_atual}/${t.numero_parcelas}`;
                                }
                            }

                            return (
                                <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center group hover:shadow-md transition-shadow">
                                    <div className="flex-1">
                                        <p className="font-medium text-slate-900">{t.descricao}</p>
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                            <span>{format(t.data, "dd/MM/yyyy", { locale: ptBR })}</span>
                                            <span>•</span>
                                            <span>{CategoryLabels[t.categoria]}</span>
                                            {installmentText && (
                                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded flex items-center border border-blue-100 font-medium">
                                                    {installmentText}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-4">
                                        <div>
                                            <p className="font-bold text-red-600">
                                                - R$ {displayValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {PaymentMethodLabels[t.metodo_pagamento]}
                                            </p>
                                        </div>

                                        {/* Ações */}
                                        <div className="flex flex-col items-end gap-1">
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
                                            {t.user_id_gasto && (
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded italic">
                                                    {cards.flatMap(c => c.users_assigned || []).find(m => m.id === t.user_id_gasto)?.nome || "Membro"}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
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

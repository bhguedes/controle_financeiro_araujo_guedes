"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getMyTransactions, addTransaction, updateTransaction, deleteTransaction, processRecurringExpenses, deleteTransactionsBulk } from "@/services/financeService";
import { getMyCards } from "@/services/financeService";
import { getMyAccounts } from "@/services/accountService";
import { NewExpenseForm } from "@/components/NewExpenseForm";
import { Card, BankAccount, Transaction, TransactionType, TransactionStatus, TransactionFormData, CategoryLabels, PaymentMethodLabels } from "@/types";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Pencil, Trash2, PlusCircle, Filter, Users, CreditCard, ListChecks, XCircle } from "lucide-react";
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

    // Selection Mode
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

            await processRecurringExpenses(user.uid, selectedDate);

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
                tipo: TransactionType.VARIAVEL,
                status: TransactionStatus.COMPLETED
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
            await deleteTransaction(t.id);
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

    // Bulk Actions
    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (ids: string[]) => {
        if (selectedIds.length === ids.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(ids);
        }
    };

    const handleBulkDelete = async () => {
        let title = `Tem certeza que deseja excluir ${selectedIds.length} transações? Esta ação não pode ser desfeita.`;
        let idsToDelete = [...selectedIds];

        // Se estiver no modo histórico, check for grouped items to Cascade Delete
        if (viewMode === 'history') {
            const extraIds: string[] = [];
            selectedIds.forEach(id => {
                const t = transactions.find(x => x.id === id);
                if (t?.parcelado && t.compra_parcelada_id) {
                    // Encontrar irmãos ocultos (same purchase ID)
                    const siblings = transactions.filter(x => x.compra_parcelada_id === t.compra_parcelada_id && x.id !== id);
                    siblings.forEach(s => extraIds.push(s.id));
                }
            });

            if (extraIds.length > 0) {
                idsToDelete = [...idsToDelete, ...extraIds];
                title = `Atenção: Você selecionou compras parceladas no Modo Histórico.\n\nIsso excluirá TODAS as ${idsToDelete.length} parcelas vinculadas a estas compras (incluindo as de outros meses).\n\nDeseja continuar?`;
            }
        }

        if (!confirm(title)) return;

        try {
            setLoading(true);
            const uniqueIds = Array.from(new Set(idsToDelete));
            await deleteTransactionsBulk(uniqueIds);
            setSelectedIds([]);
            setIsSelectionMode(false);
            await loadData();
            alert("Transações excluídas com sucesso!");
        } catch (error) {
            console.error("Erro ao excluir em massa:", error);
            alert("Erro ao excluir transações. Verifique o console.");
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const pendingTransactions = transactions
        .filter(t => t.status === TransactionStatus.PENDING)
        .filter(t => filterCard === "all" || t.card_id === filterCard)
        .filter(t => filterMember === "all" || t.user_id_gasto === filterMember || t.user_id_criador === filterMember)
        .filter(t => {
            if (viewMode === 'monthly') {
                return t.data.getMonth() === selectedDate.getMonth() &&
                    t.data.getFullYear() === selectedDate.getFullYear();
            }
            return true;
        });

    let displayedTransactions = transactions
        .filter(t => t.status !== TransactionStatus.PENDING)
        .filter(t => filterCard === "all" || t.card_id === filterCard)
        .filter(t => filterMember === "all" || t.user_id_gasto === filterMember || t.user_id_criador === filterMember);

    if (viewMode === 'monthly') {
        displayedTransactions = displayedTransactions.filter(t =>
            t.data.getMonth() === selectedDate.getMonth() &&
            t.data.getFullYear() === selectedDate.getFullYear()
        );
    } else {
        const groupedTransactions: { [key: string]: Transaction } = {};
        const singleTransactions: Transaction[] = [];

        displayedTransactions.forEach(t => {
            if (t.parcelado && t.compra_parcelada_id) {
                const existing = groupedTransactions[t.compra_parcelada_id];
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
                        {isSelectionMode && selectedIds.length > 0 ? (
                            <Button
                                variant="destructive"
                                className="gap-2 animate-in fade-in"
                                onClick={handleBulkDelete}
                                disabled={loading}
                            >
                                <Trash2 className="h-4 w-4" />
                                Excluir ({selectedIds.length})
                            </Button>
                        ) : (
                            <>
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
                            </>
                        )}
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

                    {/* Toggle Mode & Selection */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant={isSelectionMode ? "secondary" : "outline"}
                            onClick={() => {
                                setIsSelectionMode(!isSelectionMode);
                                setSelectedIds([]);
                            }}
                            className={`gap-2 ${isSelectionMode ? 'bg-slate-200' : 'bg-white'}`}
                        >
                            {isSelectionMode ? <XCircle className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
                            {isSelectionMode ? "Cancelar" : "Selecionar"}
                        </Button>

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
                        <h2 className="text-lg font-semibold text-orange-800 mb-4 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Pendentes de Confirmação
                        </h2>
                        <div className="space-y-3">
                            {pendingTransactions.map(t => (
                                <div
                                    key={t.id}
                                    className={`bg-white p-4 rounded-lg shadow-sm border border-orange-200 flex items-center gap-3 transition-colors ${isSelectionMode ? 'cursor-pointer hover:bg-orange-50' : ''}`}
                                    onClick={() => isSelectionMode && toggleSelection(t.id)}
                                >
                                    {isSelectionMode && (
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(t.id)}
                                            readOnly
                                            className="h-5 w-5 rounded border-slate-300 text-blue-600"
                                        />
                                    )}
                                    <div className="flex-1 flex justify-between items-center">
                                        <div>
                                            <p className="font-medium text-slate-900">{t.descricao}</p>
                                            <p className="text-sm text-slate-500">
                                                {format(t.data, "dd 'de' MMMM", { locale: ptBR })} • {CategoryLabels[t.categoria]}
                                            </p>
                                            <p className="font-bold text-slate-900 mt-1">
                                                R$ {t.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>

                                        {!isSelectionMode && (
                                            <div className="flex gap-2">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={(e) => { e.stopPropagation(); setEditingTransaction(t); }}
                                                    className="text-slate-400 hover:text-blue-600"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(t); }}
                                                    className="text-slate-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700 ml-2"
                                                    onClick={(e) => { e.stopPropagation(); handleConfirmTransaction(t); }}
                                                >
                                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                                    Confirmar
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Lista de Transações */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            {isSelectionMode && (
                                <input
                                    type="checkbox"
                                    checked={displayedTransactions.length > 0 && selectedIds.length === displayedTransactions.length} // Simplificacao para demo
                                    onChange={() => handleSelectAll(displayedTransactions.map(t => t.id))}
                                    className="h-5 w-5 rounded border-slate-300"
                                    title="Selecionar Todos Visíveis"
                                />
                            )}
                            <h2 className="text-xl font-semibold text-slate-800">
                                {viewMode === 'monthly' ? `Gastos de ${format(selectedDate, "MMMM", { locale: ptBR })}` : 'Histórico Completo'}
                            </h2>
                        </div>
                        {viewMode === 'monthly' && (
                            <span className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                                Total: R$ {displayedTransactions.reduce((acc, t) => acc + (t.tipo === TransactionType.RENDA ? -t.valor : t.valor), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
                            const isParceladoReview = viewMode === 'history' && t.parcelado && (t.numero_parcelas || 0) > 1;
                            let displayValue = t.valor;
                            let installmentText = null;

                            if (viewMode === 'history') {
                                if (isParceladoReview) {
                                    displayValue = t.valor * (t.numero_parcelas || 1);
                                    installmentText = `Parcela ${getInstallmentInfo(t)}`;
                                }
                            } else {
                                if (t.parcelado) {
                                    installmentText = `Parcela ${t.parcela_atual}/${t.numero_parcelas}`;
                                }
                            }

                            return (
                                <div
                                    key={t.id}
                                    className={`bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3 group hover:shadow-md transition-shadow ${isSelectionMode ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                                    onClick={() => isSelectionMode && toggleSelection(t.id)}
                                >
                                    {isSelectionMode && (
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(t.id)}
                                            readOnly
                                            className="h-5 w-5 rounded border-slate-300 text-blue-600"
                                        />
                                    )}
                                    <div className="flex-1 flex justify-between items-center">
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
                                                <p className={`font-bold ${t.tipo === TransactionType.RENDA ? "text-green-600" : "text-red-600"}`}>
                                                    {t.tipo === TransactionType.RENDA ? "+" : "-"} R$ {t.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {PaymentMethodLabels[t.metodo_pagamento]}
                                                </p>
                                            </div>

                                            {!isSelectionMode && (
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={(e) => { e.stopPropagation(); setEditingTransaction(t); }}
                                                            className="h-8 w-8 text-slate-400 hover:text-blue-600"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(t); }}
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

"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getMyTransactions, addTransaction, updateTransaction, deleteTransaction, processRecurringExpenses, deleteTransactionsBulk, updateTransactionsBulkMember, assignMemberToPurchase } from "@/services/financeService";
import { getMyCards } from "@/services/financeService";
import { getMyAccounts } from "@/services/accountService";
import { NewExpenseForm } from "@/components/NewExpenseForm";
import { Card, BankAccount, Transaction, TransactionType, TransactionStatus, TransactionFormData, CategoryLabels, PaymentMethodLabels, PaymentMethod } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Import Input
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select
import { CheckCircle2, AlertCircle, Pencil, Trash2, PlusCircle, Filter, Users, CreditCard, ListChecks, XCircle, ArrowUpDown } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CsvImporter } from "@/components/CsvImporter";
import { SwipeableTransactionItem } from "@/components/SwipeableTransactionItem";
import { AssignMemberDialog } from "@/components/AssignMemberDialog";
import { getMemberColor } from "@/lib/utils";



export default function DespesasPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [cards, setCards] = useState<Card[]>([]);
    const [accounts, setAccounts] = useState<BankAccount[]>([]);

    // State for Editing
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [assignTarget, setAssignTarget] = useState<Transaction | null>(null);
    const [isAssignOpen, setIsAssignOpen] = useState(false);

    // Filters
    const [filterCard, setFilterCard] = useState<string>("all");
    const [filterMember, setFilterMember] = useState<string>("all");
    const [sortOption, setSortOption] = useState<string>("date_desc"); // Sorting State

    // View State
    const [viewMode, setViewMode] = useState<'monthly' | 'history'>('monthly');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [closingDay, setClosingDay] = useState<number>(31); // Closing Date State

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

    // Helper for LocalStorage
    const getStorageKey = (d: Date) => `closing_day_${format(d, 'yyyy-MM')}`;

    const getSavedClosingDay = (d: Date) => {
        if (typeof window === 'undefined') return null;
        const saved = localStorage.getItem(getStorageKey(d));
        return saved ? parseInt(saved) : null;
    };

    const saveClosingDay = (d: Date, day: number) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(getStorageKey(d), day.toString());
    };

    // Update closingDay when month changes
    useEffect(() => {
        const saved = getSavedClosingDay(selectedDate);
        if (saved) {
            setClosingDay(saved);
        } else {
            setClosingDay(endOfMonth(selectedDate).getDate());
        }
    }, [selectedDate]);

    const loadData = async (silent: boolean = false) => {
        if (!user) return;
        try {
            if (!silent) setLoading(true);
            const [myCards, myAccounts, myTransactions] = await Promise.all([
                getMyCards(user.uid),
                getMyAccounts(user.uid),
                getMyTransactions(user.uid)
            ]);

            setCards(myCards);
            setAccounts(myAccounts);

            await processRecurringExpenses(user.uid, selectedDate);

            // Raw list, sorting applied later
            setTransactions(myTransactions);
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
            loadData(true);
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
            loadData(true);
        } catch (error) {
            console.error("Error updating transaction:", error);
            alert("Erro ao atualizar transação");
        }
    };

    const handleDelete = async (t: Transaction) => {
        if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;
        try {
            await deleteTransaction(t.id);
            loadData(true);
        } catch (error) {
            console.error("Error deleting transaction:", error);
        }
    };

    const handleConfirmTransaction = async (t: Transaction) => {
        try {
            await updateTransaction(t.id, { status: TransactionStatus.COMPLETED });
            loadData(true);
        } catch (error) {
            console.error("Error confirming transaction:", error);
        }
    };

    const handleAssignMember = async (memberId: string) => {
        if (!assignTarget) return;
        try {
            // Use new service to propagate to all installments if applicable
            await assignMemberToPurchase(assignTarget.id, memberId);
            loadData(true);
            setIsAssignOpen(false);
            setAssignTarget(null);
        } catch (error) {
            console.error("Error assigning member:", error);
            alert("Erro ao atribuir membro");
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

        if (viewMode === 'history') {
            const extraIds: string[] = [];
            selectedIds.forEach(id => {
                const t = transactions.find(x => x.id === id);
                if (t?.parcelado && t.compra_parcelada_id) {
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
            await loadData(true);
            alert("Transações excluídas com sucesso!");
        } catch (error) {
            console.error("Erro ao excluir em massa:", error);
            alert("Erro ao excluir transações. Verifique o console.");
        } finally {
            setLoading(false);
        }
    };

    const handleBulkAssign = async (memberId: string) => {
        if (!confirm(`Atribuir ${selectedIds.length} transações ao membro selecionado?`)) return;
        try {
            setLoading(true);
            await updateTransactionsBulkMember(selectedIds, memberId);
            setSelectedIds([]);
            setIsSelectionMode(false);
            setIsAssignOpen(false);
            // setAssignTarget(null); // Not used in bulk
            await loadData(true);
            alert("Transações atribuídas com sucesso!");
        } catch (error) {
            console.error("Erro ao atribuir em massa:", error);
            alert("Erro ao atribuir transações.");
        } finally {
            setLoading(false);
        }
    };

    // Aggregated Members for Bulk Assign
    const allUniqueMembers = useMemo(() => {
        const map = new Map();
        cards.forEach(card => {
            card.users_assigned?.forEach(u => {
                map.set(u.id, u);
            });
        });
        return Array.from(map.values());
    }, [cards]);

    // --- FILTER & SORT LOGIC ---

    // 1. Filter PENDING
    const pendingTransactions = transactions
        .filter(t => t.status === TransactionStatus.PENDING)
        .filter(t => filterCard === "all" || t.card_id === filterCard)
        .filter(t => filterMember === "all" || t.user_id_gasto === filterMember || t.user_id_criador === filterMember)
        .filter(t => isSameMonth(t.data, selectedDate)); // Pending usually for current context or needs strict check? adhering to monthly view for now.

    // 2. Filter DISPLAYED
    const filteredTransactions = useMemo(() => {
        let filtered = transactions.filter(t => t.status !== TransactionStatus.PENDING);

        // A. Card/Member Filters
        filtered = filtered.filter(t => filterCard === "all" || t.card_id === filterCard);
        filtered = filtered.filter(t => filterMember === "all" || t.user_id_gasto === filterMember || t.user_id_criador === filterMember);

        // B. View Mode (Monthly Range vs History)
        if (viewMode === 'monthly') {
            // Determine Range based on Closing Day
            const maxDays = endOfMonth(selectedDate).getDate();
            const actualClosingDay = Math.min(closingDay, maxDays);

            // Period: Start of Range to End of Range
            // If Closing 31 (Max): 1st to 31st.
            // If Closing 25: Prev 26th to Curr 25th.

            let start: Date, end: Date;

            if (actualClosingDay >= maxDays) {
                start = startOfMonth(selectedDate);
                end = endOfMonth(selectedDate);
            } else {
                // Range: (PrevMonth ClosingDay + 1) to (CurrMonth ClosingDay)
                // NOTE: We assume the cycle is somewhat consistent. 
                // Start = PrevMonth Date(actualClosingDay + 1)
                start = subMonths(selectedDate, 1);
                start.setDate(actualClosingDay + 1);
                start = startOfDay(start);

                end = new Date(selectedDate);
                end.setDate(actualClosingDay);
                end = endOfDay(end);
            }

            filtered = filtered.filter(t => {
                const d = t.data;
                return d >= start && d <= end;
            });

        } else {
            // History Mode: Consolidate Installments
            const groupedTransactions: { [key: string]: Transaction } = {};
            const singleTransactions: Transaction[] = [];

            filtered.forEach(t => {
                if (t.parcelado && t.compra_parcelada_id) {
                    const existing = groupedTransactions[t.compra_parcelada_id];
                    // Keep the EARLIEST date for history sort? Or latest? Usually earliest purchase date.
                    if (!existing || t.data < existing.data) {
                        groupedTransactions[t.compra_parcelada_id] = t;
                    }
                } else {
                    singleTransactions.push(t);
                }
            });
            filtered = [
                ...singleTransactions,
                ...Object.values(groupedTransactions)
            ];
        }

        // C. Sort
        return filtered.sort((a, b) => {
            let valA: any, valB: any;

            switch (sortOption) {
                case "date_asc":
                    return a.data.getTime() - b.data.getTime();
                case "value_desc":
                    return b.valor - a.valor;
                case "value_asc":
                    return a.valor - b.valor;
                case "person_asc":
                    // Get User Name
                    const nameA = cards.find(c => c.id === a.card_id)?.users_assigned?.find(u => u.id === a.user_id_gasto)?.nome || "";
                    const nameB = cards.find(c => c.id === b.card_id)?.users_assigned?.find(u => u.id === b.user_id_gasto)?.nome || "";
                    return nameA.localeCompare(nameB);
                case "category_asc":
                    return CategoryLabels[a.categoria].localeCompare(CategoryLabels[b.categoria]);
                case "installments_desc":
                    const remA = a.parcelado ? (a.numero_parcelas || 0) - (a.parcela_atual || 0) : -1;
                    const remB = b.parcelado ? (b.numero_parcelas || 0) - (b.parcela_atual || 0) : -1;
                    return remB - remA;
                case "date_desc":
                default:
                    return b.data.getTime() - a.data.getTime();
            }
        });

    }, [transactions, filterCard, filterMember, viewMode, selectedDate, closingDay, sortOption, cards]);

    const displayedTransactions = filteredTransactions;

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
                            <>
                                <Button
                                    variant="destructive"
                                    className="gap-2 animate-in fade-in"
                                    onClick={handleBulkDelete}
                                    disabled={loading}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Excluir ({selectedIds.length})
                                </Button>
                                <Button
                                    className="gap-2 animate-in fade-in bg-blue-600 hover:bg-blue-700"
                                    onClick={() => {
                                        setAssignTarget(null); // Clear single target to indicate bulk
                                        setIsAssignOpen(true);
                                    }}
                                    disabled={loading}
                                >
                                    <Users className="h-4 w-4" />
                                    Atribuir ({selectedIds.length})
                                </Button>
                            </>
                        ) : (
                            <>
                                <CsvImporter cards={cards} onSuccess={() => loadData(false)} monthReference={selectedDate} />
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
                <div className="flex flex-col gap-4 mb-6 sticky top-0 z-50 bg-slate-50 py-2">
                    {/* Row 1: Filters Card, Member, Sort */}
                    <div className="flex flex-col md:flex-row gap-2">
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

                        {/* Sort Options */}
                        <div className="flex-1 md:max-w-[200px]">
                            <Select value={sortOption} onValueChange={setSortOption}>
                                <SelectTrigger className="w-full h-full min-h-[46px] bg-white border-slate-100 shadow-sm rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <ArrowUpDown className="h-4 w-4 text-slate-400" />
                                        <SelectValue placeholder="Ordernar" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="date_desc">📅 Mais Recentes</SelectItem>
                                    <SelectItem value="date_asc">📅 Mais Antigas</SelectItem>
                                    <SelectItem value="value_desc">💰 Valor (Maior)</SelectItem>
                                    <SelectItem value="value_asc">💰 Valor (Menor)</SelectItem>
                                    <SelectItem value="person_asc">👤 Pessoa (A-Z)</SelectItem>
                                    <SelectItem value="category_asc">🏷️ Categoria (A-Z)</SelectItem>
                                    <SelectItem value="installments_desc">💳 Parcelas (+)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 2: View Mode, Closing Day */}
                    <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
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

                            <Button
                                variant={isSelectionMode ? "secondary" : "outline"}
                                onClick={() => {
                                    setIsSelectionMode(!isSelectionMode);
                                    setSelectedIds([]);
                                }}
                                className={`gap-2 ${isSelectionMode ? 'bg-slate-200' : 'bg-white'}`}
                            >
                                {isSelectionMode ? <XCircle className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
                                <span className="hidden md:inline">{isSelectionMode ? "Cancelar" : "Selecionar"}</span>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Navegação de Mês + Closing Day Input */}
                {viewMode === 'monthly' && (
                    <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
                        <div className="flex-1 flex items-center justify-between w-full">
                            <Button variant="ghost" onClick={handlePrevMonth}>
                                &larr; <span className="hidden md:inline">Anterior</span>
                            </Button>
                            <h2 className="text-lg font-bold text-slate-800 capitalize">
                                {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
                            </h2>
                            <Button variant="ghost" onClick={handleNextMonth}>
                                <span className="hidden md:inline">Próximo</span> &rarr;
                            </Button>
                        </div>

                        <div className="flex items-center gap-2 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100 w-full md:w-auto justify-center">
                            <span className="text-sm font-medium text-slate-600 whitespace-nowrap">Dia Fechamento:</span>
                            <Input
                                type="number"
                                min={1}
                                max={31}
                                className="w-16 h-9"
                                value={closingDay}
                                onChange={(e) => {
                                    let val = parseInt(e.target.value);
                                    if (isNaN(val)) val = 1;
                                    if (val > 31) val = 31;
                                    setClosingDay(val);
                                    saveClosingDay(selectedDate, val);
                                }}
                            />
                        </div>
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
                                    checked={displayedTransactions.length > 0 && selectedIds.length === displayedTransactions.length}
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
                            let installmentText = undefined;

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
                                    className={`relative transition-all rounded-xl ${isSelectionMode ? 'pl-10 ' : ''}`}
                                    onClick={() => isSelectionMode && toggleSelection(t.id)}
                                >
                                    {isSelectionMode && (
                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(t.id)}
                                                readOnly // Handled by div click
                                                className="h-5 w-5 rounded border-slate-300 text-blue-600 cursor-pointer"
                                            />
                                        </div>
                                    )}
                                    <SwipeableTransactionItem
                                        item={t}
                                        displayValue={displayValue}
                                        installmentText={installmentText}
                                        onEdit={setEditingTransaction}
                                        onDelete={handleDelete}
                                        onAssign={(tx) => {
                                            setAssignTarget(tx);
                                            setIsAssignOpen(true);
                                        }}
                                        showAssign={t.metodo_pagamento === PaymentMethod.CARTAO_CREDITO}
                                        assignedName={
                                            t.user_id_gasto
                                                ? cards.find(c => c.id === t.card_id)?.users_assigned?.find(u => u.id === t.user_id_gasto)?.nome
                                                : undefined
                                        }
                                        memberColor={t.user_id_gasto ? getMemberColor(cards.find(c => c.id === t.card_id)?.users_assigned?.find(u => u.id === t.user_id_gasto)?.nome || "") : undefined}
                                    />
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

                <AssignMemberDialog
                    open={isAssignOpen}
                    onOpenChange={setIsAssignOpen}
                    card={assignTarget ? cards.find(c => c.id === assignTarget.card_id) : undefined}
                    // If bulk (assignTarget null), pass allUniqueMembers wrapper or let dialog handle it?
                    // The dialog likely expects a 'card' prop to derive members. 
                    // To avoid editing Dialog excessively, I can pass a "Fake Card" with all members if assignTarget is null.
                    // Or better, update AssignMemberDialog to accept 'membersList' override.
                    // Checking existing usage: <AssignMemberDialog ... card={...} ... />
                    // I will check AssignMemberDialog first. For now, I'll pass a dummy card with aggregated users for bulk.
                    forcedMembers={!assignTarget ? allUniqueMembers : undefined}

                    selectedMemberId={assignTarget?.user_id_gasto}
                    onAssign={!assignTarget ? handleBulkAssign : handleAssignMember}
                    currentUserId={user?.uid || ""}
                    title={!assignTarget ? "Atribuir em Massa" : undefined}
                />
            </div>
        </main >
    );
}

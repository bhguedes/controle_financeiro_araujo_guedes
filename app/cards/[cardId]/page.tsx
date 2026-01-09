"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getCard, getTransactionsByCard } from "@/services/financeService";
import { Card, Transaction, CategoryLabels, TransactionType } from "@/types";
import { calcularMesFatura, obterMesAtual } from "@/lib/invoiceUtils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowLeft, CreditCard, Calendar, Users } from "lucide-react";
import { format, addMonths, subMonths, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getMemberColor } from "@/lib/utils";

export default function CardInvoicePage() {
    const { user } = useAuth();
    const params = useParams();
    const router = useRouter();
    const cardId = params.cardId as string;

    const [card, setCard] = useState<Card | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [invoiceMonthStr, setInvoiceMonthStr] = useState<string>(obterMesAtual());
    const [filterMember, setFilterMember] = useState<string>("all");
    const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);

    useEffect(() => {
        if (user && cardId) {
            loadCardData();
        }
    }, [user, cardId]);

    useEffect(() => {
        if (card) {
            loadInvoiceData();
        }
    }, [card, currentMonth]); // Reload when month changes

    const loadCardData = async () => {
        try {
            const cardData = await getCard(cardId);
            if (!cardData) {
                alert("Cartão não encontrado");
                router.push("/cards");
                return;
            }
            setCard(cardData);
        } catch (error) {
            console.error(error);
        }
    };

    const loadInvoiceData = async () => {
        if (!card) return;
        setLoading(true);
        try {
            // Determine the "Invoice Month" string based on currentMonth selection
            // We assume the user selects a month (e.g. "January 2025") and we want transactions where mes_fatura == "2025-01"
            const monthStr = format(currentMonth, "yyyy-MM");
            setInvoiceMonthStr(monthStr);

            const txs = await getTransactionsByCard(cardId, monthStr);
            // Sort by date desc
            txs.sort((a, b) => b.data.getTime() - a.data.getTime());
            setTransactions(txs);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handlePreviousMonth = () => {
        setCurrentMonth(prev => subMonths(prev, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(prev => addMonths(prev, 1));
    };

    const toggleExpand = (id: string) => {
        if (expandedTransactionId === id) {
            setExpandedTransactionId(null);
        } else {
            setExpandedTransactionId(id);
        }
    };

    const renderFutureInstallments = (t: Transaction) => {
        if (!t.parcelado || !t.numero_parcelas || !t.parcela_atual) return null;

        const installments = [];
        const total = t.numero_parcelas;
        const currentCheck = t.parcela_atual;

        // Se a parcela atual for a última, não há futuras
        if (currentCheck >= total) {
            return (
                <p className="text-sm text-slate-500 italic mt-2">
                    Esta é a última parcela.
                </p>
            );
        }

        // Calcula próximas parcelas a partir do mês SEGUINTE ao da fatura atual
        // Se estamos vendo Fatura Jan/2025 (currentMonth), a próxima será em Fev/2025
        let nextMonthDate = addMonths(currentMonth, 1);

        for (let i = currentCheck + 1; i <= total; i++) {
            installments.push({
                parcela: i,
                data: new Date(nextMonthDate),
                valor: t.valor_parcela || t.valor // Usa valor_parcela se existir, senão o valor atual (que deve ser o da parcela)
            });
            nextMonthDate = addMonths(nextMonthDate, 1);
        }

        return (
            <div className="mt-4 bg-blue-50/50 rounded-lg p-4 border border-blue-100">
                <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Próximas Faturas
                </h4>
                <div className="space-y-2">
                    {installments.map((inst) => (
                        <div key={inst.parcela} className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">
                                {format(inst.data, "MMMM yyyy", { locale: ptBR })}
                                <span className="text-xs text-slate-400 ml-2">(Parcela {inst.parcela}/{total})</span>
                            </span>
                            <span className="font-medium text-slate-900">
                                R$ {inst.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const filteredTransactions = filterMember === "all"
        ? transactions
        : transactions.filter(t => t.user_id_gasto === filterMember || t.user_id_criador === filterMember);

    const totalInvoice = transactions.reduce((acc, t) => acc + (t.tipo === TransactionType.RENDA ? -t.valor : t.valor), 0);

    if (!user) return null;
    if (!card && loading) return <div className="p-8 text-center text-slate-600">Carregando cartão...</div>;
    if (!card) return null;

    return (
        <main className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <Button variant="ghost" className="mb-4 pl-0 hover:bg-transparent hover:text-emerald-600" onClick={() => router.push("/cards")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar para Cartões
                </Button>

                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <CreditCard className="h-8 w-8 text-blue-600" />
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">{card.nome_cartao}</h1>
                                <div className="flex gap-4 text-sm text-slate-600 mt-1">
                                    <span>Limite: <span className="font-semibold text-slate-900">R$ {card.limite.toLocaleString("pt-BR")}</span></span>
                                    <span>Fechamento: dia {card.dia_fechamento}</span>
                                    <span>Vencimento: dia {card.dia_vencimento}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            {/* Member Filter */}
                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <Users className="h-4 w-4 text-slate-500" />
                                <select
                                    className="bg-transparent text-sm font-medium text-slate-900 outline-none"
                                    value={filterMember}
                                    onChange={(e) => setFilterMember(e.target.value)}
                                >
                                    <option value="all">Todos os Membros</option>
                                    {card.users_assigned?.map(m => (
                                        <option key={m.id} value={m.id}>{m.nome}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Month Selector */}
                            <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
                                    <ChevronLeft className="h-5 w-5 text-slate-600" />
                                </Button>
                                <div className="text-center min-w-[140px]">
                                    <span className="block text-sm text-slate-500">Fatura de</span>
                                    <span className="font-semibold text-slate-900 capitalize">
                                        {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                                    </span>
                                </div>
                                <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                                    <ChevronRight className="h-5 w-5 text-slate-600" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-sm text-slate-600">Total da Fatura {filterMember !== 'all' ? `(${filterMember})` : ''}</p>
                            <p className="text-3xl font-bold text-slate-900">
                                R$ {filteredTransactions.reduce((acc, t) => acc + (t.tipo === TransactionType.RENDA ? -t.valor : t.valor), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${totalInvoice > 0 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                            {totalInvoice > 0 ? "Fatura em Aberto" : "Sem Gastos"}
                        </div>
                    </div>
                </div>

                {/* Transactions List */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Transações do Mês
                        </h2>
                        {filterMember !== 'all' && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                                Filtrado por: {card.users_assigned?.find(m => m.id === filterMember)?.nome || "Membro"}
                            </span>
                        )}
                    </div>


                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Carregando transações...</div>
                    ) : transactions.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            Nenhuma transação encontrada para esta fatura.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filteredTransactions.map(t => {
                                // Resolve Member Name and Color
                                const memberId = t.user_id_gasto;
                                const member = memberId ? card.users_assigned?.find(u => u.id === memberId) : null;
                                const memberName = member ? member.nome : (memberId ? "Membro" : "Você");
                                const memberColor = memberId ? getMemberColor(memberName) : null;

                                return (
                                    <div key={t.id} className="group">
                                        <div
                                            onClick={() => t.parcelado && toggleExpand(t.id)}
                                            className={`p-4 hover:bg-slate-50 transition-colors flex justify-between items-center ${t.parcelado ? 'cursor-pointer' : ''}`}
                                            style={{
                                                borderLeftColor: memberColor || 'transparent',
                                                borderLeftWidth: memberColor ? '4px' : '0px',
                                                paddingLeft: memberColor ? '12px' : '16px'
                                            }}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-full mt-1 ${t.parcelado ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                                                    <span className="text-lg" role="img" aria-label="Icon">
                                                        {t.parcelado ? '📅' : '💰'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-slate-900">{t.descricao}</p>
                                                        {/* Badges */}
                                                        {t.parcelado ? (
                                                            <span className="text-[10px] uppercase font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full tracking-wide">
                                                                Parcelado ({t.parcela_atual}/{t.numero_parcelas})
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] uppercase font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full tracking-wide">
                                                                À vista
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
                                                        <span>{format(t.data, "dd/MM", { locale: ptBR })}</span>
                                                        <span>•</span>
                                                        <span>{CategoryLabels[t.categoria]}</span>
                                                        <span className="text-xs text-slate-400">
                                                            (Por: <span style={{ color: memberColor || undefined, fontWeight: memberColor ? 600 : 400 }}>{memberName}</span>)
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-2">
                                                    <p className={`font-bold ${t.tipo === TransactionType.RENDA ? "text-green-600" : "text-slate-900"}`}>
                                                        {t.tipo === TransactionType.RENDA ? "+ " : ""}R$ {t.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                    </p>
                                                    {t.parcelado && (
                                                        <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${expandedTransactionId === t.id ? 'rotate-90' : ''}`} />
                                                    )}
                                                </div>
                                                {t.is_recurring && (
                                                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                        🔄 Recorrente
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Expandable Content for Installments */}
                                        {expandedTransactionId === t.id && t.parcelado && (
                                            <div className="px-14 pb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                                {renderFutureInstallments(t)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

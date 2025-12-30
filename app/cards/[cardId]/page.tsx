"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getCard, getTransactionsByCard } from "@/services/financeService";
import { Card, Transaction, CategoryLabels } from "@/types";
import { calcularMesFatura, obterMesAtual } from "@/lib/invoiceUtils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowLeft, CreditCard, Calendar } from "lucide-react";
import { format, addMonths, subMonths, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

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

    const totalInvoice = transactions.reduce((acc, t) => acc + t.valor, 0);

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

                    <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-sm text-slate-600">Total da Fatura</p>
                            <p className="text-3xl font-bold text-slate-900">
                                R$ {totalInvoice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        {/* Status badge? */}
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${totalInvoice > 0 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                            {totalInvoice > 0 ? "Fatura em Aberto" : "Sem Gastos"}
                        </div>
                    </div>
                </div>

                {/* Transactions List */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Transações do Mês
                        </h2>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Carregando transações...</div>
                    ) : transactions.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            Nenhuma transação encontrada para esta fatura.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {transactions.map(t => (
                                <div key={t.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                                    <div className="flex items-start gap-3">
                                        <div className="bg-slate-100 p-2 rounded-full mt-1">
                                            <span className="text-lg">🛍️</span> {/* Placeholder icon */}
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">{t.descricao}</p>
                                            <div className="text-sm text-slate-500 flex items-center gap-2">
                                                <span>{format(t.data, "dd/MM", { locale: ptBR })}</span>
                                                <span>•</span>
                                                <span>{CategoryLabels[t.categoria]}</span>
                                                {t.parcelado && (
                                                    <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-xs ml-1">
                                                        {t.parcela_atual}/{t.numero_parcelas}
                                                    </span>
                                                )}
                                                <span className="text-xs text-slate-400">
                                                    (Criado por: {t.user_id_criador === user.uid ? "Você" : "Outro"})
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-slate-900">
                                            R$ {t.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

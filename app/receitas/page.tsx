"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    getIncomesByMonth,
    addIncome,
    updateIncomeStatus,
    deleteIncome,
    getIncomeStats,
} from "@/services/incomeService";
import { getMyCards } from "@/services/financeService";
import { NewIncomeForm } from "@/components/NewIncomeForm";
import { Button } from "@/components/ui/button";
import { Card, CardUser, Income, IncomeStatus, IncomeFormData, IncomeStatusLabels } from "@/types";
import { DollarSign, TrendingUp, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ReceitasPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [incomes, setIncomes] = useState<Income[]>([]);
    const [members, setMembers] = useState<CardUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalPrevisto: 0,
        totalRecebido: 0,
        percentualRecebido: 0,
    });

    // Controle de mês/ano
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        if (user) {
            loadData();
        } else {
            setLoading(false);
        }
    }, [user, selectedMonth, selectedYear]);

    const loadData = async () => {
        if (!user) return;

        try {
            setLoading(true);

            // Carrega membros dos cartões (se existirem)
            try {
                const cards = await getMyCards(user.uid);
                const allMembers: CardUser[] = [];
                cards.forEach((card) => {
                    allMembers.push(...card.users_assigned);
                });
                // Remove duplicatas por nome
                const uniqueMembers = allMembers.filter((member, index, self) =>
                    index === self.findIndex((m) => m.nome === member.nome)
                );
                setMembers(uniqueMembers);
            } catch (error) {
                console.log("Nenhum cartão encontrado, mas pode cadastrar receitas mesmo assim");
                setMembers([]);
            }

            // Carrega receitas do mês
            const monthIncomes = await getIncomesByMonth(
                user.uid,
                selectedYear,
                selectedMonth
            );
            setIncomes(monthIncomes);

            // Carrega estatísticas
            const monthStats = await getIncomeStats(
                user.uid,
                selectedYear,
                selectedMonth
            );
            setStats(monthStats);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleNewIncome = async (
        data: IncomeFormData & { membroNome: string }
    ) => {
        if (!user) return;

        try {
            await addIncome(user.uid, {
                descricao: data.descricao,
                valor: data.valor,
                membroId: data.membroId,
                membroNome: data.membroNome,
                tipo: data.tipo,
                data_recebimento: data.data_recebimento,
                dia_recorrencia: data.dia_recorrencia,
            });

            alert("Receita cadastrada com sucesso!");
            loadData();
        } catch (error) {
            console.error("Erro ao cadastrar receita:", error);
            alert("Erro ao cadastrar receita. Verifique o console.");
        }
    };

    const handleToggleStatus = async (income: Income) => {
        try {
            const newStatus =
                income.status === IncomeStatus.PENDENTE
                    ? IncomeStatus.RECEBIDO
                    : IncomeStatus.PENDENTE;

            await updateIncomeStatus(income.id, newStatus);
            loadData();
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            alert("Erro ao atualizar status da receita.");
        }
    };

    const handleDeleteIncome = async (incomeId: string, descricao: string) => {
        if (!confirm(`Tem certeza que deseja excluir a receita "${descricao}"?`)) {
            return;
        }

        try {
            await deleteIncome(incomeId);
            alert("Receita excluída com sucesso!");
            loadData();
        } catch (error) {
            console.error("Erro ao excluir receita:", error);
            alert("Erro ao excluir receita.");
        }
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(selectedYear, selectedMonth + delta, 1);
        setSelectedMonth(newDate.getMonth());
        setSelectedYear(newDate.getFullYear());
    };

    if (!user) {
        router.push("/login");
        return null;
    }

    const monthName = format(
        new Date(selectedYear, selectedMonth, 1),
        "MMMM 'de' yyyy",
        { locale: ptBR }
    );

    return (
        <main className="min-h-screen bg-gradient-to-br from-green-50 to-slate-100 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-slate-900 mb-2">
                        💰 Receitas
                    </h1>
                    <p className="text-slate-600">
                        Gerencie as receitas da família
                    </p>
                </div>

                {/* Seletor de Mês */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            onClick={() => changeMonth(-1)}
                        >
                            ← Mês Anterior
                        </Button>
                        <h2 className="text-2xl font-semibold text-slate-800 capitalize">
                            {monthName}
                        </h2>
                        <Button
                            variant="outline"
                            onClick={() => changeMonth(1)}
                        >
                            Próximo Mês →
                        </Button>
                    </div>

                    <NewIncomeForm members={members} onSubmit={handleNewIncome} />
                </div>

                {/* Cards de Estatísticas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Total Previsto */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <DollarSign className="h-8 w-8 text-blue-600" />
                            <h3 className="text-lg font-semibold text-slate-800">
                                Total Previsto
                            </h3>
                        </div>
                        <p className="text-3xl font-bold text-blue-600">
                            R$ {stats.totalPrevisto.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                            })}
                        </p>
                    </div>

                    {/* Total Recebido */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                            <h3 className="text-lg font-semibold text-slate-800">
                                Total Recebido
                            </h3>
                        </div>
                        <p className="text-3xl font-bold text-green-600">
                            R$ {stats.totalRecebido.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                            })}
                        </p>
                    </div>

                    {/* Percentual Realizado */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <TrendingUp className="h-8 w-8 text-purple-600" />
                            <h3 className="text-lg font-semibold text-slate-800">
                                Realizado
                            </h3>
                        </div>
                        <p className="text-3xl font-bold text-purple-600">
                            {stats.percentualRecebido.toFixed(1)}%
                        </p>
                        <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                            <div
                                className="bg-purple-600 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(stats.percentualRecebido, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Lista de Receitas */}
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <h2 className="text-2xl font-semibold text-slate-800 mb-4">
                        📋 Receitas do Mês
                    </h2>

                    {loading ? (
                        <p className="text-slate-600">Carregando...</p>
                    ) : incomes.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-slate-500 mb-4">
                                Nenhuma receita cadastrada para este mês.
                            </p>
                            <NewIncomeForm
                                members={members}
                                onSubmit={handleNewIncome}
                                trigger={
                                    <Button>
                                        <DollarSign className="h-4 w-4 mr-2" />
                                        Cadastrar Primeira Receita
                                    </Button>
                                }
                            />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {incomes.map((income) => (
                                <div
                                    key={income.id}
                                    className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${income.status === IncomeStatus.RECEBIDO
                                        ? "border-green-200 bg-green-50"
                                        : "border-slate-200 bg-white"
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-semibold text-slate-800">
                                                    {income.descricao}
                                                </h4>
                                                <span
                                                    className={`text-xs px-2 py-1 rounded-full ${income.status === IncomeStatus.RECEBIDO
                                                        ? "bg-green-100 text-green-800"
                                                        : "bg-yellow-100 text-yellow-800"
                                                        }`}
                                                >
                                                    {IncomeStatusLabels[income.status]}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600">
                                                {income.membroNome} •{" "}
                                                {income.recorrente ? "Recorrente" : "Única"} •{" "}
                                                {format(income.data_recebimento, "dd/MM/yyyy")}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="font-bold text-lg text-slate-900">
                                                    R${" "}
                                                    {income.valor.toLocaleString("pt-BR", {
                                                        minimumFractionDigits: 2,
                                                    })}
                                                </p>
                                            </div>

                                            <Button
                                                variant={
                                                    income.status === IncomeStatus.RECEBIDO
                                                        ? "default"
                                                        : "outline"
                                                }
                                                size="sm"
                                                onClick={() => handleToggleStatus(income)}
                                                className="gap-2"
                                            >
                                                {income.status === IncomeStatus.RECEBIDO ? (
                                                    <>
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        Recebido
                                                    </>
                                                ) : (
                                                    <>
                                                        <Clock className="h-4 w-4" />
                                                        Marcar Recebido
                                                    </>
                                                )}
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    handleDeleteIncome(income.id, income.descricao)
                                                }
                                            >
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </div>
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

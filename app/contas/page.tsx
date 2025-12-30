"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    getMyAccounts,
    addBankAccount,
    updateBankAccount,
    deleteBankAccount,
    addInvestment,
    getAccountInvestments,
    updateInvestment,
    deleteInvestment,
    calculateNetWorth,
} from "@/services/accountService";
import { addTransaction } from "@/services/financeService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    BankAccount,
    Investment,
    AccountType,
    InvestmentType,
    AccountTypeLabels,
    InvestmentTypeLabels,
    BankAccountFormData,
    TransactionStatus,
    TransactionType,
    Category,
    PaymentMethod
} from "@/types";
import { Wallet, TrendingUp, PlusCircle, Trash2, Edit, DollarSign, Landmark } from "lucide-react";
import { NewAccountForm } from "@/components/NewAccountForm";

export default function ContasPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [investments, setInvestments] = useState<{ [key: string]: Investment[] }>({});
    const [netWorth, setNetWorth] = useState({ totalContas: 0, totalInvestimentos: 0, patrimonioLiquido: 0 });
    const [loading, setLoading] = useState(true);

    // Modal states
    // Modal states
    const [investmentModalOpen, setInvestmentModalOpen] = useState(false);
    const [simulatorModalOpen, setSimulatorModalOpen] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState("");

    // Form states - Account (Removed, handled by NewAccountForm)

    // Form states - Investment
    const [tipoInvestimento, setTipoInvestimento] = useState<InvestmentType>(InvestmentType.RENDA_FIXA);
    const [nomeInvestimento, setNomeInvestimento] = useState("");
    const [valorInvestido, setValorInvestido] = useState("");
    const [valorAtual, setValorAtual] = useState("");
    const [dataAplicacao, setDataAplicacao] = useState("");
    const [investTaxaMensal, setInvestTaxaMensal] = useState("");
    const [investAporteMensal, setInvestAporteMensal] = useState("");

    // Simulator states
    const [simValorInicial, setSimValorInicial] = useState("");
    const [simTaxaMensal, setSimTaxaMensal] = useState("");
    const [simMeses, setSimMeses] = useState("");
    const [simAporteMensal, setSimAporteMensal] = useState("");
    const [simResultado, setSimResultado] = useState(0);

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
            const userAccounts = await getMyAccounts(user.uid);
            setAccounts(userAccounts);

            // Carrega investimentos
            const investmentsMap: { [key: string]: Investment[] } = {};
            for (const account of userAccounts) {
                try {
                    const accountInvestments = await getAccountInvestments(account.id);
                    investmentsMap[account.id] = accountInvestments;
                } catch (err) {
                    console.warn(`Erro ao carregar investimentos da conta ${account.id}`, err);
                    investmentsMap[account.id] = [];
                }
            }
            setInvestments(investmentsMap);

            // Calcula patrimônio
            const worth = await calculateNetWorth(user.uid);
            setNetWorth(worth);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddAccount = async (data: BankAccountFormData) => {
        if (!user) return;
        try {
            await addBankAccount(user.uid, {
                nome_banco: data.nome_banco,
                tipo_conta: data.tipo_conta,
                saldo_atual: data.saldo_atual,
                is_shared: data.is_shared,
            });
            alert("Conta adicionada com sucesso!");
            loadData();
        } catch (error) {
            console.error("Erro ao adicionar conta:", error);
            alert("Erro ao adicionar conta.");
        }
    };

    const handleAddInvestment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !selectedAccountId) return;
        // Ajusta a data para o meio-dia local para evitar problemas de fuso horário
        const adjustedDate = new Date(dataAplicacao);
        adjustedDate.setHours(12, 0, 0, 0);

        try {
            await addInvestment(user.uid, selectedAccountId, {
                tipo: tipoInvestimento,
                nome: nomeInvestimento,
                valor_investido: parseFloat(valorInvestido),
                valor_atual: parseFloat(valorAtual),
                data_aplicacao: adjustedDate,
                taxa_fixa_mensal: parseFloat(investTaxaMensal) || 0,
                aporte_mensal: parseFloat(investAporteMensal) || 0,
            });
            alert("Investimento adicionado com sucesso!");
            setInvestmentModalOpen(false);
            resetInvestmentForm();
            loadData();
        } catch (error) {
            console.error("Erro ao adicionar investimento:", error);
            alert("Erro ao adicionar investimento.");
        }
    };

    const handleDeleteAccount = async (accountId: string, nomeBanco: string) => {
        if (!confirm(`Tem certeza que deseja excluir a conta ${nomeBanco}?`)) return;
        try {
            await deleteBankAccount(accountId);
            alert("Conta excluída!");
            loadData();
        } catch (error) {
            console.error("Erro ao excluir conta:", error);
            alert("Erro ao excluir conta.");
        }
    };

    const handleCreateGoal = async () => {
        if (!user || !selectedAccountId) {
            if (!selectedAccountId) {
                alert("Por favor, abra o simulador a partir de uma conta específica para cadastrar a meta.");
                return;
            }
        }

        try {
            const aporte = parseFloat(simAporteMensal) || 0;
            const taxa = parseFloat(simTaxaMensal) || 0;

            // Ajusta a data para o meio-dia local
            const goalDate = new Date();
            goalDate.setHours(12, 0, 0, 0);

            await addInvestment(user!.uid, selectedAccountId, {
                tipo: InvestmentType.RENDA_FIXA,
                nome: `Meta: ${aporte > 0 ? 'Aporte Mensal' : 'Investimento'}`,
                valor_investido: parseFloat(simValorInicial) || 0,
                valor_atual: parseFloat(simValorInicial) || 0,
                data_aplicacao: goalDate,
                taxa_fixa_mensal: taxa,
                aporte_mensal: aporte
            });

            if (aporte > 0) {
                // Create pending transaction logic here if desired
                await addTransaction(user!.uid, {
                    descricao: "Aporte: Meta Investimento",
                    valor: aporte,
                    categoria: Category.INVESTIMENTOS,
                    data: goalDate,
                    tipo: TransactionType.CONTA_FIXA, // Changed to CONTA_FIXA as it is recurring? Or VARIAVEL? Usually Invest is Expense.
                    // But TransactionType only has RENDA, CONTA_FIXA, VARIAVEL.
                    // Expense is implied by NOT RENDA? No.
                    // Transaction Logic: Type is ENUM.
                    // If Type is CONTA_FIXA, it is expense.
                    metodo_pagamento: PaymentMethod.DINHEIRO_PIX, // Default
                    status: TransactionStatus.PENDING,
                    is_recurring: true
                });
            }

            alert("Meta cadastrada com sucesso! Verifique sua nova Despesa Pendente.");
            setSimulatorModalOpen(false);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Erro ao cadastrar meta.");
        }
    };

    const handleSimulate = () => {
        const inicial = parseFloat(simValorInicial) || 0;
        const taxa = (parseFloat(simTaxaMensal) || 0) / 100;
        const meses = parseInt(simMeses) || 0;
        const aporte = parseFloat(simAporteMensal) || 0;

        if (meses <= 0) {
            alert("Periodo deve ser maior que 0");
            return;
        }

        // FV = P*(1+i)^n + PMT * [((1+i)^n - 1) / i]
        let montante = 0;

        if (taxa === 0) {
            montante = inicial + (aporte * meses);
        } else {
            const compoundFactor = Math.pow(1 + taxa, meses);
            const futureValuePrincipal = inicial * compoundFactor;
            const futureValueSeries = aporte * ((compoundFactor - 1) / taxa);
            montante = futureValuePrincipal + futureValueSeries;
        }

        setSimResultado(montante);
    };

    // resetAccountForm removed

    const resetInvestmentForm = () => {
        setTipoInvestimento(InvestmentType.RENDA_FIXA);
        setNomeInvestimento("");
        setValorInvestido("");
        setValorAtual("");
        setDataAplicacao("");
        setInvestTaxaMensal("");
        setInvestAporteMensal("");
    };

    if (!user) {
        router.push("/login");
        return null;
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Landmark className="h-8 w-8 text-blue-600" />
                        </div>
                        Contas Bancárias
                    </h1>
                    <p className="text-slate-600">
                        Gerencie suas contas e investimentos
                    </p>
                </div>

                {/* Cards de Resumo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Wallet className="h-8 w-8 text-blue-600" />
                            <h3 className="text-lg font-semibold text-slate-800">Total em Contas</h3>
                        </div>
                        <p className="text-3xl font-bold text-blue-600">
                            R$ {netWorth.totalContas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <TrendingUp className="h-8 w-8 text-green-600" />
                            <h3 className="text-lg font-semibold text-slate-800">Total Investido</h3>
                        </div>
                        <p className="text-3xl font-bold text-green-600">
                            R$ {netWorth.totalInvestimentos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <DollarSign className="h-8 w-8 text-purple-600" />
                            <h3 className="text-lg font-semibold text-slate-800">Patrimônio Líquido</h3>
                        </div>
                        <p className="text-3xl font-bold text-purple-600">
                            R$ {netWorth.patrimonioLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex flex-wrap gap-3 mb-6">
                    <NewAccountForm onSubmit={handleAddAccount} />

                    <Dialog open={simulatorModalOpen} onOpenChange={setSimulatorModalOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Simulador de Rendimentos
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Simulador de Rendimentos</DialogTitle>
                                <DialogDescription>
                                    Simule o rendimento futuro de um investimento
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Valor Inicial (R$)</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={simValorInicial}
                                        onChange={(e) => setSimValorInicial(e.target.value)}
                                        placeholder="1000.00"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Taxa Mensal (%)</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={simTaxaMensal}
                                        onChange={(e) => setSimTaxaMensal(e.target.value)}
                                        placeholder="0.5"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Período (meses)</Label>
                                    <Input
                                        type="number"
                                        value={simMeses}
                                        onChange={(e) => setSimMeses(e.target.value)}
                                        placeholder="Ex: 12"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Aporte Mensal (R$)</Label>
                                    <Input
                                        type="number"
                                        value={simAporteMensal}
                                        onChange={(e) => setSimAporteMensal(e.target.value)}
                                        placeholder="Ex: 500.00"
                                    />
                                </div>
                                <Button onClick={handleSimulate} className="w-full">
                                    Calcular
                                </Button>

                                {simResultado > 0 && (
                                    <div className="bg-green-50 rounded-lg p-4 text-center space-y-3">
                                        <div>
                                            <p className="text-sm text-green-700 mb-1">Valor Final Estimado:</p>
                                            <p className="text-2xl font-bold text-green-900">
                                                R$ {simResultado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                            </p>
                                            <p className="text-xs text-green-600 mt-2">
                                                Total Investido: R$ {(parseFloat(simValorInicial) + (parseFloat(simAporteMensal || "0") * parseInt(simMeses))).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                <br />
                                                Rendimento: R$ {(simResultado - (parseFloat(simValorInicial) + (parseFloat(simAporteMensal || "0") * parseInt(simMeses)))).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>

                                        <Button
                                            onClick={handleCreateGoal}
                                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                                        >
                                            <TrendingUp className="h-4 w-4 mr-2" />
                                            Cadastrar Meta
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Lista de Contas */}
                <div className="space-y-6">
                    {loading ? (
                        <p className="text-slate-600">Carregando...</p>
                    ) : accounts.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                            <p className="text-slate-500 mb-4">Nenhuma conta cadastrada</p>
                            <p className="text-slate-500 mb-4">Nenhuma conta cadastrada</p>
                            <NewAccountForm onSubmit={handleAddAccount} trigger={
                                <Button>
                                    <PlusCircle className="h-4 w-4 mr-2" />
                                    Adicionar Primeira Conta
                                </Button>
                            } />
                        </div>
                    ) : (
                        accounts.map((account) => (
                            <div key={account.id} className="bg-white rounded-xl shadow-lg p-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-xl font-bold text-slate-900">{account.nome_banco}</h3>
                                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                                                {AccountTypeLabels[account.tipo_conta]}
                                            </span>
                                            {account.is_shared && (
                                                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                                                    Compartilhada
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-2xl font-bold text-blue-600">
                                            R$ {account.saldo_atual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedAccountId(account.id);
                                                setInvestmentModalOpen(true);
                                            }}
                                        >
                                            <PlusCircle className="h-4 w-4 mr-1" />
                                            Investimento
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteAccount(account.id, account.nome_banco)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Investimentos da conta */}
                                {investments[account.id] && investments[account.id].length > 0 && (
                                    <div className="mt-4 pt-4 border-t">
                                        <h4 className="font-semibold text-slate-800 mb-3">Investimentos</h4>
                                        <div className="space-y-2">
                                            {investments[account.id].map((inv) => (
                                                <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                    <div>
                                                        <p className="font-medium text-slate-800">{inv.nome}</p>
                                                        <p className="text-sm text-slate-600">
                                                            {InvestmentTypeLabels[inv.tipo]} • Rentabilidade: {inv.rentabilidade.toFixed(2)}%
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-slate-900">
                                                            R$ {inv.valor_atual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            Investido: R$ {inv.valor_investido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Modal de Investimento */}
                <Dialog open={investmentModalOpen} onOpenChange={setInvestmentModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Adicionar Investimento</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddInvestment} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Tipo de Investimento *</Label>
                                <Select value={tipoInvestimento} onValueChange={(v) => setTipoInvestimento(v as InvestmentType)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.values(InvestmentType).map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {InvestmentTypeLabels[type]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Nome *</Label>
                                <Input
                                    value={nomeInvestimento}
                                    onChange={(e) => setNomeInvestimento(e.target.value)}
                                    placeholder="Ex: Tesouro Direto, CDB"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Valor Investido (R$) *</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={valorInvestido}
                                        onChange={(e) => setValorInvestido(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Valor Atual (R$) *</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={valorAtual}
                                        onChange={(e) => setValorAtual(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Rentabilidade Mensal (%)</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={investTaxaMensal}
                                        onChange={(e) => setInvestTaxaMensal(e.target.value)}
                                        placeholder="Ex: 0.8"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Aporte Mensal (R$)</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={investAporteMensal}
                                        onChange={(e) => setInvestAporteMensal(e.target.value)}
                                        placeholder="Ex: 200.00"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Data da Aplicação *</Label>
                                <Input
                                    type="date"
                                    value={dataAplicacao}
                                    onChange={(e) => setDataAplicacao(e.target.value)}
                                    required
                                />
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setInvestmentModalOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit">Adicionar</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </main>
    );
}

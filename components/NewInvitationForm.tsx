"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BankAccount, Card, Investment } from "@/types";
import {
    UserPlus,
    Mail,
    CreditCard,
    Wallet,
    TrendingUp,
    Check,
    ArrowRight,
    ArrowLeft,
    Copy,
    Share2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createInvitation } from "@/services/familyService";
import { getMyCards } from "@/services/financeService";
import { getMyAccounts, getMyInvestments } from "@/services/accountService";

// Schema de validação
const invitationSchema = z.object({
    inviteeName: z.string().min(1, "Nome é obrigatório"),
    inviteeEmail: z.string().email("Email inválido"),
    roleLabel: z.string().min(1, "Parentesco é obrigatório (ex: Esposa)"),
});

type InvitationFormValues = z.infer<typeof invitationSchema>;

interface NewInvitationFormProps {
    userId: string;
    userName: string;
    familyId: string;
    familyName: string;
    trigger?: React.ReactNode;
}

const STEPS = [
    { id: 'details', title: 'Dados do Convidado', icon: UserPlus },
    { id: 'cards', title: 'Compartilhar Cartões', icon: CreditCard },
    { id: 'accounts', title: 'Compartilhar Contas', icon: Wallet },
    { id: 'investments', title: 'Compartilhar Investimentos', icon: TrendingUp },
    { id: 'review', title: 'Confirmar e Enviar', icon: Check },
];

export function NewInvitationForm({ userId, userName, familyId, familyName, trigger }: NewInvitationFormProps) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [createdCode, setCreatedCode] = useState<string | null>(null);

    // Data lists
    const [myCards, setMyCards] = useState<Card[]>([]);
    const [myAccounts, setMyAccounts] = useState<BankAccount[]>([]);
    const [myInvestments, setMyInvestments] = useState<Investment[]>([]);

    // Selected IDs
    const [selectedCards, setSelectedCards] = useState<string[]>([]);
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
    const [selectedInvestments, setSelectedInvestments] = useState<string[]>([]);

    const {
        register,
        handleSubmit,
        watch,
        trigger: validateStep,
        formState: { errors },
        reset
    } = useForm<InvitationFormValues>({
        resolver: zodResolver(invitationSchema),
    });

    const formValues = watch();

    useEffect(() => {
        if (open) {
            setLoading(true);
            Promise.all([
                getMyCards(userId),
                getMyAccounts(userId),
                getMyInvestments(userId)
            ]).then(([cards, accounts, investments]) => {
                setMyCards(cards);
                setMyAccounts(accounts);
                setMyInvestments(investments);
                setLoading(false);
            }).catch(console.error);
        } else {
            // Reset state when closed
            setStep(0);
            setCreatedCode(null);
            setEmailSent(false);
            setSendingEmail(false);
            setSelectedCards([]);
            setSelectedAccounts([]);
            setSelectedInvestments([]);
            reset();
        }
    }, [open, userId, reset]);

    const handleNext = async () => {
        if (step === 0) {
            const valid = await validateStep();
            if (!valid) return;
        }
        setStep(s => Math.min(s + 1, STEPS.length - 1));
    };

    const handleBack = () => {
        setStep(s => Math.max(s - 1, 0));
    };

    const handleToggle = (id: string, list: string[], setList: (l: string[]) => void) => {
        if (list.includes(id)) {
            setList(list.filter(item => item !== id));
        } else {
            setList([...list, id]);
        }
    };

    const onSubmit = async () => {
        setLoading(true);
        try {
            const result = await createInvitation(
                familyId,
                familyName,
                userId,
                userName,
                formValues.inviteeName,
                formValues.inviteeEmail,
                formValues.roleLabel,
                {
                    cards: selectedCards,
                    accounts: selectedAccounts,
                    investments: selectedInvestments
                }
            );
            setCreatedCode(result.code);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async () => {
        if (!createdCode) return;

        setSendingEmail(true);
        try {
            const response = await fetch('/api/send-invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inviteeName: formValues.inviteeName,
                    inviteeEmail: formValues.inviteeEmail,
                    code: createdCode,
                    inviterName: userName,
                    familyName: familyName,
                    link: `${window.location.origin}/convite/${createdCode}`
                })
            });

            if (response.ok) {
                setEmailSent(true);
            } else {
                const data = await response.json();
                console.error("Erro ao enviar email:", data);
                alert("Erro ao enviar email: " + (data.error || "Erro desconhecido"));
            }
        } catch (error) {
            console.error("Erro de rede:", error);
            alert("Erro de rede ao enviar email.");
        } finally {
            setSendingEmail(false);
        }
    };

    const handleCopyCode = () => {
        if (createdCode) {
            navigator.clipboard.writeText(createdCode);
        }
    };

    if (createdCode) {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>{trigger}</DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-center text-2xl text-emerald-600">Convite Criado!</DialogTitle>
                        <DialogDescription className="text-center">
                            O convite para <b>{formValues.inviteeName}</b> foi gerado com sucesso.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col items-center space-y-4 py-4">
                        <div className="bg-slate-100 p-4 rounded-xl w-full text-center space-y-2">
                            <p className="text-sm text-slate-500">Código de Acesso</p>
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-3xl font-mono font-bold tracking-widest text-slate-800">
                                    {createdCode}
                                </span>
                                <Button size="icon" variant="ghost" onClick={handleCopyCode}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {emailSent ? (
                            <div className="w-full flex items-center justify-center gap-2 bg-green-100 text-green-800 font-medium py-3 rounded-lg border border-green-200">
                                <Check className="h-5 w-5" />
                                Email Enviado com Sucesso!
                            </div>
                        ) : (
                            <Button
                                onClick={handleSendEmail}
                                disabled={sendingEmail}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-6 rounded-lg transition-colors"
                            >
                                <Mail className="h-5 w-5" />
                                {sendingEmail ? "Enviando..." : "Enviar Convite por Email"}
                            </Button>
                        )}

                        <p className="text-xs text-slate-400 text-center px-4">
                            Clique em enviar para disparar o convite automático para <b>{formValues.inviteeEmail}</b>.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 gap-2">
                        <UserPlus className="h-4 w-4" />
                        Novo Convite
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col p-0 overflow-hidden bg-slate-50 border-none rounded-2xl">
                {/* Header */}
                <div className="bg-white p-6 pb-4 border-b border-slate-100">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
                            {(() => {
                                const Icon = STEPS[step].icon;
                                return <Icon className="h-5 w-5 text-emerald-600" />;
                            })()}
                            {STEPS[step].title}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex gap-1 h-1">
                        {STEPS.map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "flex-1 rounded-full transition-all duration-300",
                                    i <= step ? "bg-emerald-500" : "bg-slate-200"
                                )}
                            />
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 p-6 overflow-y-auto">

                    {/* Step 0: Detalhes */}
                    {step === 0 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <Label>Nome Completo</Label>
                                <Input
                                    placeholder="Ex: Jessica Guedes"
                                    {...register("inviteeName")}
                                    className="bg-white"
                                />
                                {errors.inviteeName && <p className="text-red-500 text-sm">{errors.inviteeName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>Parentesco / Função</Label>
                                <Input
                                    placeholder="Ex: Esposa, Filho, Marido..."
                                    {...register("roleLabel")}
                                    className="bg-white"
                                />
                                {errors.roleLabel && <p className="text-red-500 text-sm">{errors.roleLabel.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    placeholder="email@exemplo.com"
                                    {...register("inviteeEmail")}
                                    className="bg-white"
                                />
                                {errors.inviteeEmail && <p className="text-red-500 text-sm">{errors.inviteeEmail.message}</p>}
                            </div>
                        </div>
                    )}

                    {/* Step 1: Cartões */}
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <p className="text-sm text-slate-500 mb-4">Selecione os cartões que essa pessoa poderá visualizar e usar:</p>
                            {myCards.length > 0 ? (
                                <div className="space-y-3">
                                    {myCards.map(card => (
                                        <div key={card.id} className="flex items-center space-x-3 bg-white p-4 rounded-lg border border-slate-200 hover:border-emerald-200 transition-colors">
                                            <Checkbox
                                                id={card.id}
                                                checked={selectedCards.includes(card.id)}
                                                onCheckedChange={() => handleToggle(card.id, selectedCards, setSelectedCards)}
                                            />
                                            <label
                                                htmlFor={card.id}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                                            >
                                                {card.nome_cartao}
                                                <span className="block text-xs text-slate-400 font-normal mt-1">
                                                    Limite: R$ {card.limite.toLocaleString('pt-BR')}
                                                </span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500 bg-slate-100 rounded-lg">
                                    Você não possui cartões cadastrados.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Contas */}
                    {step === 2 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <p className="text-sm text-slate-500 mb-4">Selecione as contas bancárias compartilhadas:</p>
                            {myAccounts.length > 0 ? (
                                <div className="space-y-3">
                                    {myAccounts.map(acc => (
                                        <div key={acc.id} className="flex items-center space-x-3 bg-white p-4 rounded-lg border border-slate-200 hover:border-emerald-200 transition-colors">
                                            <Checkbox
                                                id={acc.id}
                                                checked={selectedAccounts.includes(acc.id)}
                                                onCheckedChange={() => handleToggle(acc.id, selectedAccounts, setSelectedAccounts)}
                                            />
                                            <label
                                                htmlFor={acc.id}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                                            >
                                                {acc.nome_banco}
                                                <span className="block text-xs text-slate-400 font-normal mt-1">
                                                    Saldo: R$ {acc.saldo_atual.toLocaleString('pt-BR')}
                                                </span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500 bg-slate-100 rounded-lg">
                                    Você não possui contas cadastradas.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Investimentos */}
                    {step === 3 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <p className="text-sm text-slate-500 mb-4">Selecione os investimentos compartilhados:</p>
                            {myInvestments.length > 0 ? (
                                <div className="space-y-3">
                                    {myInvestments.map(inv => (
                                        <div key={inv.id} className="flex items-center space-x-3 bg-white p-4 rounded-lg border border-slate-200 hover:border-emerald-200 transition-colors">
                                            <Checkbox
                                                id={inv.id}
                                                checked={selectedInvestments.includes(inv.id)}
                                                onCheckedChange={() => handleToggle(inv.id, selectedInvestments, setSelectedInvestments)}
                                            />
                                            <label
                                                htmlFor={inv.id}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                                            >
                                                {inv.nome}
                                                <span className="block text-xs text-slate-400 font-normal mt-1">
                                                    Atual: R$ {inv.valor_atual.toLocaleString('pt-BR')}
                                                </span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500 bg-slate-100 rounded-lg">
                                    Você não possui investimentos cadastrados.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 4: Revisão */}
                    {step === 4 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                <h3 className="font-semibold text-slate-800 border-b pb-2">Resumo do Convite</h3>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-slate-500 mb-1">Convidado</p>
                                        <p className="font-medium">{formValues.inviteeName}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500 mb-1">Parentesco</p>
                                        <p className="font-medium">{formValues.roleLabel}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-slate-500 mb-1">Email</p>
                                        <p className="font-medium">{formValues.inviteeEmail}</p>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t">
                                    <p className="text-sm font-medium text-slate-700">Permissões de Acesso:</p>
                                    <ul className="text-sm text-slate-600 space-y-1 list-disc pl-4">
                                        <li>{selectedCards.length} Cartões selecionados</li>
                                        <li>{selectedAccounts.length} Contas selecionadas</li>
                                        <li>{selectedInvestments.length} Investimentos selecionados</li>
                                    </ul>
                                </div>
                            </div>
                            <p className="text-center text-sm text-slate-500">
                                Ao confirmar, um código único será gerado.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-white p-4 border-t border-slate-100 flex justify-between">
                    <Button
                        variant="ghost"
                        onClick={step === 0 ? () => setOpen(false) : handleBack}
                        disabled={loading}
                        className="text-slate-500 hover:text-slate-800"
                    >
                        {step === 0 ? "Cancelar" : "Voltar"}
                    </Button>

                    {step < STEPS.length - 1 ? (
                        <Button
                            onClick={handleNext}
                            className="bg-slate-900 hover:bg-slate-800 text-white gap-2 px-6"
                        >
                            Próximo <ArrowRight className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={onSubmit}
                            disabled={loading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8 shadow-lg shadow-emerald-200"
                        >
                            {loading ? "Criando..." : "Confirmar e Gerar Código"}
                            {!loading && <Check className="h-4 w-4" />}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

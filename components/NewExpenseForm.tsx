"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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
    Card,
    BankAccount,
    Category,
    TransactionType,
    PaymentMethod,
    TransactionFormData,
    CategoryLabels,
    TransactionTypeLabels,
    PaymentMethodLabels,
    CardUser,
} from "@/types";
import {
    DollarSign,
    ArrowRight,
    ArrowLeft,
    Check,
    CreditCard,
    Calendar,
    Tag,
    Wallet,
    Landmark,
    User
} from "lucide-react";
import { cn } from "@/lib/utils";

// Schema validation
const expenseSchema = z.object({
    valor: z.number().min(0.01, "Valor deve ser maior que zero"),
    descricao: z.string().min(1, "Descrição é obrigatória"),
    data: z.date(),
    tipo: z.nativeEnum(TransactionType),
    categoria: z.nativeEnum(Category),
    metodo_pagamento: z.nativeEnum(PaymentMethod),
    card_id: z.string().optional(),
    user_id_gasto: z.string().optional(),
    account_id: z.string().optional(),
    parcelado: z.boolean().optional(),
    numero_parcelas: z.number().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

interface NewExpenseFormProps {
    cards: Card[];
    accounts?: BankAccount[];
    onSubmit: (data: TransactionFormData) => void;
    trigger?: React.ReactNode;
    initialData?: Partial<TransactionFormData>;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

const STEPS = [
    { id: 'basico', title: 'Detalhes', icon: DollarSign },
    { id: 'classificacao', title: 'Classificação', icon: Tag },
    { id: 'pagamento', title: 'Forma de Pag', icon: CreditCard },
    { id: 'origem', title: 'Origem', icon: Wallet }, // Dynamically changes based on method
    { id: 'revisao', title: 'Confirmação', icon: Check },
];

export function NewExpenseForm({ cards, accounts = [], onSubmit, trigger, initialData, open: controlledOpen, onOpenChange }: NewExpenseFormProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = (newOpen: boolean) => {
        if (onOpenChange) onOpenChange(newOpen);
        if (!isControlled) setInternalOpen(newOpen);
    };

    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(0);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        trigger: validateField,
        formState: { errors },
    } = useForm<ExpenseFormValues>({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            valor: 0,
            data: new Date(),
            tipo: TransactionType.VARIAVEL,
            categoria: Category.ALIMENTACAO,
            metodo_pagamento: PaymentMethod.DINHEIRO_PIX,
            parcelado: false,
        },
    });

    const formValues = watch();

    // Derived values
    const selectedCard = useMemo(() => cards.find(c => c.id === formValues.card_id), [cards, formValues.card_id]);
    const selectedAccount = useMemo(() => accounts.find(a => a.id === formValues.account_id), [accounts, formValues.account_id]);

    const { user } = useAuth();

    const cardMembers = useMemo(() => {
        const members = selectedCard?.users_assigned || [];
        if (user) {
            // Create a "You" entry
            const me: CardUser = {
                id: user.uid,
                nome: "Eu (Titular)",
                card_id: selectedCard?.id || "",
                created_at: new Date()
            };

            // Filter out if I'm already in the list (to avoid duplicates) and prepend "Me"
            return [me, ...members.filter(m => m.id !== user.uid)];
        }
        return members;
    }, [selectedCard, user]);

    useEffect(() => {
        if (open) {
            // ... (rest of effect)
            setStep(0);
            setDirection(0);
            if (initialData) {
                // Ensure data is Date object
                const data = initialData.data instanceof Date ? initialData.data : new Date(initialData.data as any);
                reset({
                    ...initialData,
                    data,
                } as ExpenseFormValues);
            } else {
                reset({
                    valor: 0,
                    data: new Date(),
                    tipo: TransactionType.VARIAVEL,
                    categoria: Category.ALIMENTACAO,
                    metodo_pagamento: PaymentMethod.DINHEIRO_PIX,
                    parcelado: false,
                });
            }
        }
    }, [open, initialData, reset]);

    // Dynamic Step handling
    const currentSteps = useMemo(() => {
        const steps = [...STEPS];
        if (formValues.metodo_pagamento === PaymentMethod.CARTAO_CREDITO) {
            steps[3].title = "Cartão & Usuário";
            steps[3].icon = CreditCard;
        } else {
            steps[3].title = "Conta de Saída";
            steps[3].icon = Landmark;
        }
        return steps;
    }, [formValues.metodo_pagamento]);

    const handleNext = async () => {
        let valid = false;

        switch (step) {
            case 0: // Basico
                const v1 = await validateField("valor");
                const v2 = await validateField("descricao");
                const v3 = await validateField("data");
                valid = v1 && v2 && v3;
                break;
            case 1: // Classificacao
                const c1 = await validateField("tipo");
                const c2 = await validateField("categoria");
                valid = c1 && c2;
                break;
            case 2: // Pagamento
                valid = await validateField("metodo_pagamento");
                if (formValues.parcelado) valid = valid && await validateField("numero_parcelas");
                break;
            case 3: // Origem
                if (formValues.metodo_pagamento === PaymentMethod.CARTAO_CREDITO) {
                    const o1 = await validateField("card_id");
                    const o2 = await validateField("user_id_gasto");
                    valid = o1 && o2;
                    if (!valid) {
                        alert("Selecione o cartão e o usuário.");
                    }
                } else {
                    valid = await validateField("account_id");
                    if (!valid) {
                        alert("Selecione a conta bancária.");
                    }
                }
                break;
            default: valid = true;
        }

        if (valid) {
            setDirection(1);
            setStep(s => Math.min(s + 1, currentSteps.length - 1));
        }
    };

    const handleBack = () => {
        setDirection(-1);
        setStep(s => Math.max(s - 1, 0));
    };

    const handleFormSubmit = (data: ExpenseFormValues) => {
        // Ajusta a data para o meio-dia local para evitar problemas de fuso horário ao salvar no Firebase
        const adjustedDate = new Date(data.data);
        adjustedDate.setHours(12, 0, 0, 0);

        onSubmit({
            ...data,
            data: adjustedDate
        });
        setOpen(false);
        reset();
        setStep(0);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger !== undefined ? trigger : (
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all rounded-full h-14 px-8 text-lg">
                        <DollarSign className="h-6 w-6" />
                        Nova Despesa
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0 overflow-hidden bg-slate-50 border-none rounded-3xl shadow-2xl">
                {/* Header with Progress */}
                <div className="bg-white p-6 pb-2 border-b border-slate-100">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-xl font-bold flex items-center justify-center gap-2 text-slate-800">
                            {(() => {
                                const Icon = currentSteps[step].icon;
                                return Icon ? <Icon className="h-6 w-6 text-emerald-600" /> : null;
                            })()}
                            {currentSteps[step].title}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex gap-1 h-1.5 mb-2 px-4">
                        {currentSteps.map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "flex-1 rounded-full transition-all duration-500",
                                    i <= step ? "bg-emerald-500" : "bg-slate-200"
                                )}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center justify-start">
                    <form id="expense-form" onSubmit={handleSubmit(handleFormSubmit)} className="w-full space-y-6 max-w-sm mx-auto">

                        {/* Passo 0: Básico (Valor, Descrição, Data) */}
                        {step === 0 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300 flex flex-col items-center w-full">
                                <div className="w-full text-center">
                                    <Label className="text-slate-500 mb-2 block">Quanto foi?</Label>
                                    <div className="relative inline-block w-full">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-emerald-600">R$</span>
                                        <Input
                                            autoFocus
                                            id="valor"
                                            type="number"
                                            step="0.01"
                                            className="pl-12 text-center text-4xl h-20 font-bold text-slate-800 bg-white border-2 border-slate-200 focus:border-emerald-500 rounded-2xl shadow-sm"
                                            placeholder="0,00"
                                            {...register("valor", { valueAsNumber: true })}
                                        />
                                    </div>
                                    {errors.valor && <p className="text-red-500 text-sm mt-1">{errors.valor.message}</p>}
                                </div>

                                <div className="w-full">
                                    <Label className="text-slate-500 mb-2 block text-center">O que você comprou?</Label>
                                    <Input
                                        id="descricao"
                                        placeholder="Ex: Almoço, Uber..."
                                        className="text-lg h-14 text-center bg-white border-slate-200 rounded-xl"
                                        {...register("descricao")}
                                    />
                                    {errors.descricao && <p className="text-red-500 text-sm mt-1 text-center">{errors.descricao.message}</p>}
                                </div>

                                <div className="w-full">
                                    <Label className="text-slate-500 mb-2 block text-center">Quando?</Label>
                                    <Input
                                        type="date"
                                        className="text-lg h-14 text-center bg-white border-slate-200 rounded-xl"
                                        {...register("data", { valueAsDate: true })}
                                    />
                                    {errors.data && <p className="text-red-500 text-sm mt-1 text-center">{errors.data.message}</p>}
                                </div>
                            </div>
                        )}

                        {/* Passo 1: Classificação (Tipo, Categoria) */}
                        {step === 1 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300 w-full">
                                <div className="space-y-3">
                                    <Label className="text-center block text-slate-500">Tipo de Despesa</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        {Object.values(TransactionType)
                                            .filter(t => t !== TransactionType.RENDA)
                                            .map((type) => (
                                                <div
                                                    key={type}
                                                    onClick={() => setValue("tipo", type)}
                                                    className={cn(
                                                        "cursor-pointer p-4 rounded-xl border-2 transition-all text-center",
                                                        formValues.tipo === type
                                                            ? "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold"
                                                            : "bg-white border-slate-200 text-slate-600 hover:border-emerald-200"
                                                    )}
                                                >
                                                    {TransactionTypeLabels[type]}
                                                </div>
                                            ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-center block text-slate-500">Categoria</Label>
                                    <Select onValueChange={(v) => setValue("categoria", v as Category)} defaultValue={formValues.categoria}>
                                        <SelectTrigger className="h-14 text-lg bg-white border-slate-200 rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            {Object.values(Category)
                                                // Filter out Income categories if needed, or keeping all as some use unexpected ones
                                                .filter(c => ![Category.SALARIO, Category.FREELANCE, Category.INVESTIMENTOS, Category.OUTROS_RENDIMENTOS].includes(c))
                                                .map((cat) => (
                                                    <SelectItem key={cat} value={cat}>
                                                        {CategoryLabels[cat]}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {/* Passo 2: Pagamento (Metodo, Parcelas) */}
                        {step === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300 w-full">
                                <div className="space-y-3">
                                    <Label className="text-center block text-slate-500">Como você pagou?</Label>
                                    <div className="grid grid-cols-1 gap-3">
                                        {Object.values(PaymentMethod).map((method) => (
                                            <div
                                                key={method}
                                                onClick={() => {
                                                    setValue("metodo_pagamento", method);
                                                    if (method !== PaymentMethod.CARTAO_CREDITO) {
                                                        setValue("parcelado", false);
                                                    }
                                                }}
                                                className={cn(
                                                    "cursor-pointer p-5 rounded-xl border-2 transition-all flex items-center justify-between",
                                                    formValues.metodo_pagamento === method
                                                        ? "bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500"
                                                        : "bg-white border-slate-200 hover:border-emerald-200"
                                                )}
                                            >
                                                <span className="font-semibold text-lg">{PaymentMethodLabels[method]}</span>
                                                {formValues.metodo_pagamento === method && <Check className="h-6 w-6 text-emerald-600" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {formValues.metodo_pagamento === PaymentMethod.CARTAO_CREDITO && (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="parcelado" className="text-base cursor-pointer">Compra Parcelada?</Label>
                                            <input
                                                type="checkbox"
                                                id="parcelado"
                                                className="w-6 h-6 text-emerald-600 rounded focus:ring-emerald-500"
                                                checked={formValues.parcelado}
                                                onChange={(e) => setValue("parcelado", e.target.checked)}
                                            />
                                        </div>

                                        {formValues.parcelado && (
                                            <div className="space-y-2">
                                                <Label className="text-center block text-slate-500">Número de Parcelas</Label>
                                                <Input
                                                    type="number"
                                                    min="2"
                                                    max="24"
                                                    className="text-center text-lg h-12 bg-white"
                                                    placeholder="Ex: 3"
                                                    {...register("numero_parcelas", { valueAsNumber: true })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Passo 3: Origem (Cartão/Usuário OR Conta) */}
                        {step === 3 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300 w-full">
                                {formValues.metodo_pagamento === PaymentMethod.CARTAO_CREDITO ? (
                                    <>
                                        <div className="space-y-3">
                                            <Label className="text-center block text-slate-500">Qual Cartão?</Label>
                                            {cards.length > 0 ? (
                                                <Select onValueChange={(v) => setValue("card_id", v)} defaultValue={formValues.card_id}>
                                                    <SelectTrigger className="h-14 text-lg bg-white border-slate-200 rounded-xl">
                                                        <SelectValue placeholder="Selecione..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {cards.map(card => (
                                                            <SelectItem key={card.id} value={card.id}>{card.nome_cartao}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <p className="text-red-500 text-center">Nenhum cartão cadastrado.</p>
                                            )}
                                        </div>

                                        {formValues.card_id && (
                                            <div className="space-y-3 animate-in fade-in">
                                                <Label className="text-center block text-slate-500">Quem comprou?</Label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {cardMembers.map(member => (
                                                        <div
                                                            key={member.id}
                                                            onClick={() => setValue("user_id_gasto", member.id)}
                                                            className={cn(
                                                                "cursor-pointer p-3 rounded-lg border-2 text-center text-sm font-medium transition-all",
                                                                formValues.user_id_gasto === member.id
                                                                    ? "bg-slate-800 border-slate-800 text-white"
                                                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                                            )}
                                                        >
                                                            {member.nome}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    // Dinheiro / PIX
                                    <div className="space-y-3">
                                        <Label className="text-center block text-slate-500">De qual conta saiu?</Label>
                                        {accounts.length > 0 ? (
                                            <Select onValueChange={(v) => setValue("account_id", v)} defaultValue={formValues.account_id}>
                                                <SelectTrigger className="h-14 text-lg bg-white border-slate-200 rounded-xl">
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {accounts.map(acc => (
                                                        <SelectItem key={acc.id} value={acc.id}>
                                                            {acc.nome_banco} - R$ {acc.saldo_atual.toFixed(2)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="text-center p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
                                                Nenhuma conta bancária cadastrada.
                                                <p className="text-xs mt-1">Cadastre uma conta na aba "Contas".</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Passo 4: Revisão */}
                        {step === 4 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-8 duration-300 w-full">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-center">
                                    <div className="pb-4 border-b border-slate-100">
                                        <span className="text-slate-500 text-sm uppercase tracking-wide">Valor Total</span>
                                        <div className="text-4xl font-bold text-emerald-600 mt-1">
                                            R$ {formValues.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>

                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Descrição</span>
                                            <span className="font-semibold">{formValues.descricao}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Categoria</span>
                                            <span className="font-semibold">{CategoryLabels[formValues.categoria]}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Pagamento</span>
                                            <span className="font-semibold">{PaymentMethodLabels[formValues.metodo_pagamento]}</span>
                                        </div>

                                        {formValues.metodo_pagamento === PaymentMethod.CARTAO_CREDITO ? (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Cartão</span>
                                                    <span className="font-semibold">{selectedCard?.nome_cartao}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Comprador</span>
                                                    <span className="font-semibold">
                                                        {cardMembers.find(m => m.id === formValues.user_id_gasto)?.nome}
                                                    </span>
                                                </div>
                                                {formValues.parcelado && (
                                                    <div className="flex justify-between text-emerald-600 font-bold">
                                                        <span className="">Parcelado</span>
                                                        <span className="">{formValues.numero_parcelas}x</span>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Conta</span>
                                                <span className="font-semibold">{selectedAccount?.nome_banco || "Não selecionada"}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between pt-2 border-t border-slate-100">
                                            <span className="text-slate-500">Data</span>
                                            <span className="font-semibold">{formValues.data?.toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-center text-sm text-slate-500">
                                    Tudo certo? Confirme para salvar.
                                </p>
                            </div>
                        )}

                    </form>
                </div>

                <div className="bg-white p-4 border-t border-slate-100 flex justify-between items-center z-10 w-full pb-6">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={step === 0 ? () => setOpen(false) : handleBack}
                        className="text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    >
                        {step === 0 ? "Cancelar" : "Voltar"}
                    </Button>

                    <div className="flex gap-2">
                        {step < currentSteps.length - 1 ? (
                            <Button
                                type="button"
                                onClick={handleNext}
                                className="bg-slate-900 hover:bg-slate-800 text-white gap-2 px-8 rounded-full h-12 shadow-lg hover:shadow-xl transition-all"
                            >
                                Próximo <ArrowRight className="h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                type="submit"
                                form="expense-form"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-10 rounded-full h-12 shadow-lg shadow-emerald-200 hover:shadow-xl transition-all"
                            >
                                Salvar <Check className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

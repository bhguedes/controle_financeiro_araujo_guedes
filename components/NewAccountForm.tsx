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
    BankAccountFormData,
    AccountType,
    AccountTypeLabels,
} from "@/types";
import {
    PlusCircle,
    ArrowRight,
    ArrowLeft,
    Check,
    Landmark,
    Wallet,
    DollarSign,
    Users
} from "lucide-react";
import { cn } from "@/lib/utils";

const accountSchema = z.object({
    nome_banco: z.string().min(1, "Nome do banco é obrigatório"),
    tipo_conta: z.nativeEnum(AccountType, {
        errorMap: () => ({ message: "Selecione um tipo de conta" }),
    }),
    saldo_atual: z.number({ required_error: "Saldo inicial é obrigatório" }),
    is_shared: z.boolean(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

interface NewAccountFormProps {
    onSubmit: (data: BankAccountFormData) => void;
    trigger?: React.ReactNode;
}

const STEPS = [
    { id: 'nome', title: 'Qual o banco?', icon: Landmark },
    { id: 'tipo', title: 'Tipo de Conta', icon: Wallet },
    { id: 'saldo', title: 'Saldo Atual', icon: DollarSign },
    { id: 'shared', title: 'Compartilhamento', icon: Users },
    { id: 'revisao', title: 'Confirmação', icon: Check },
];

export function NewAccountForm({ onSubmit, trigger }: NewAccountFormProps) {
    const [open, setOpen] = useState(false);
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
    } = useForm<AccountFormValues>({
        resolver: zodResolver(accountSchema),
        defaultValues: {
            tipo_conta: AccountType.CORRENTE,
            saldo_atual: 0,
            is_shared: false,
        },
    });

    const formValues = watch();

    useEffect(() => {
        if (open) {
            setStep(0);
            setDirection(0);
        }
    }, [open]);

    const handleNext = async () => {
        let valid = false;

        switch (step) {
            case 0: valid = await validateField("nome_banco"); break;
            case 1: valid = await validateField("tipo_conta"); break;
            case 2: valid = await validateField("saldo_atual"); break;
            case 3: valid = await validateField("is_shared"); break;
            default: valid = true;
        }

        if (valid) {
            setDirection(1);
            setStep(s => Math.min(s + 1, STEPS.length - 1));
        }
    };

    const handleBack = () => {
        setDirection(-1);
        setStep(s => Math.max(s - 1, 0));
    };

    const handleFormSubmit = (data: AccountFormValues) => {
        onSubmit(data);
        setOpen(false);
        reset();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all">
                        <PlusCircle className="h-5 w-5" />
                        Nova Conta
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] h-[550px] flex flex-col p-0 overflow-hidden bg-slate-50 border-none rounded-2xl shadow-2xl">
                <div className="bg-white p-6 pb-2 border-b border-slate-100">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
                            {(() => {
                                const Icon = STEPS[step].icon;
                                return Icon ? <Icon className="h-5 w-5 text-emerald-600" /> : null;
                            })()}
                            {STEPS[step].title}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex gap-1 h-1 mb-2">
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

                <div className="flex-1 p-6 overflow-y-auto">
                    <form id="account-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">

                        {/* Passo 0: Nome do Banco */}
                        {step === 0 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <Input
                                    autoFocus
                                    id="nome_banco"
                                    placeholder="Ex: Nubank, Itaú..."
                                    className="text-lg h-14 bg-white"
                                    {...register("nome_banco")}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNext())}
                                />
                                {errors.nome_banco && <p className="text-red-500 text-sm">{errors.nome_banco.message}</p>}
                                <p className="text-center text-slate-500 text-sm">Qual o nome da instituição financeira?</p>
                            </div>
                        )}

                        {/* Passo 1: Tipo de Conta */}
                        {step === 1 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="grid gap-3">
                                    {Object.values(AccountType).map((type) => (
                                        <div
                                            key={type}
                                            onClick={() => setValue("tipo_conta", type)}
                                            className={cn(
                                                "cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center justify-between",
                                                formValues.tipo_conta === type
                                                    ? "bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500"
                                                    : "bg-white border-slate-200 hover:border-emerald-200"
                                            )}
                                        >
                                            <span className="font-semibold text-slate-700">{AccountTypeLabels[type]}</span>
                                            {formValues.tipo_conta === type && <Check className="h-5 w-5 text-emerald-600" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Passo 2: Saldo Atual */}
                        {step === 2 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-bold text-emerald-600">R$</span>
                                    <Input
                                        autoFocus
                                        id="saldo_atual"
                                        type="number"
                                        step="0.01"
                                        className="pl-14 text-4xl h-20 font-bold text-slate-800 bg-white border-none shadow-sm focus:ring-0"
                                        placeholder="0,00"
                                        {...register("saldo_atual", { valueAsNumber: true })}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNext())}
                                    />
                                </div>
                                {errors.saldo_atual && <p className="text-red-500 text-sm">{errors.saldo_atual.message}</p>}
                                <p className="text-center text-slate-500 text-sm">Qual o saldo atual desta conta?</p>
                            </div>
                        )}

                        {/* Passo 3: Compartilhamento */}
                        {step === 3 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div
                                    onClick={() => setValue("is_shared", !formValues.is_shared)}
                                    className={cn(
                                        "cursor-pointer p-6 rounded-xl border-2 transition-all space-y-2 text-center",
                                        formValues.is_shared
                                            ? "bg-emerald-50 border-emerald-500"
                                            : "bg-white border-slate-200"
                                    )}
                                >
                                    <Users className={cn("mx-auto h-12 w-12 mb-2", formValues.is_shared ? "text-emerald-600" : "text-slate-400")} />
                                    <h3 className="font-bold text-lg text-slate-800">
                                        {formValues.is_shared ? "Compartilhada" : "Pessoal"}
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                        {formValues.is_shared
                                            ? "Esta conta será visível para todos os membros da sua família."
                                            : "Esta conta será visível apenas para você."}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Passo 4: Revisão */}
                        {step === 4 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                    <div className="flex justify-between items-center pb-4 border-b">
                                        <span className="text-slate-500">Saldo Inicial</span>
                                        <span className="text-2xl font-bold text-emerald-600">
                                            R$ {formValues.saldo_atual?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Banco</span>
                                            <span className="font-medium">{formValues.nome_banco}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Tipo de Conta</span>
                                            <span className="font-medium">{AccountTypeLabels[formValues.tipo_conta]}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Visibilidade</span>
                                            <span className="font-medium flex items-center gap-1">
                                                {formValues.is_shared ? (
                                                    <><Users className="h-3 w-3" /> Compartilhada</>
                                                ) : (
                                                    "Pessoal"
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-center text-sm text-slate-500">
                                    Confirma a criação desta conta?
                                </p>
                            </div>
                        )}
                    </form>
                </div>

                <div className="bg-white p-4 border-t border-slate-100 flex justify-between">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={step === 0 ? () => setOpen(false) : handleBack}
                        className="text-slate-500 hover:text-slate-800"
                    >
                        {step === 0 ? "Cancelar" : "Voltar"}
                    </Button>

                    {step < STEPS.length - 1 ? (
                        <Button
                            type="button"
                            onClick={handleNext}
                            className="bg-slate-900 hover:bg-slate-800 text-white gap-2 px-6"
                        >
                            Próximo <ArrowRight className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            type="submit"
                            form="account-form"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8 shadow-lg shadow-emerald-200"
                        >
                            Confirmar <Check className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

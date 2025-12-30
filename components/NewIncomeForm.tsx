"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
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
    CardUser,
    IncomeFormData,
    IncomeType,
    IncomeTypeLabels,
} from "@/types";
import {
    DollarSign,
    ArrowRight,
    ArrowLeft,
    Check,
    User,
    Calendar,
    RefreshCw,
    FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

// Schema de validação com Zod
const incomeSchema = z.object({
    descricao: z.string().min(1, "Descrição é obrigatória"),
    valor: z.number().min(0.01, "Valor deve ser maior que zero"),
    membroId: z.string().min(1, "Selecione um membro da família"),
    tipo: z.nativeEnum(IncomeType, {
        errorMap: () => ({ message: "Selecione o tipo de receita" }),
    }),
    data_recebimento: z.date().optional(),
    dia_recorrencia: z.number().min(1).max(31).optional(),
});

type IncomeFormValues = z.infer<typeof incomeSchema>;

interface NewIncomeFormProps {
    members: CardUser[];
    onSubmit: (data: IncomeFormData & { membroNome: string }) => void;
    trigger?: React.ReactNode;
}

const STEPS = [
    { id: 'valor', title: 'Qual o valor?', icon: DollarSign },
    { id: 'descricao', title: 'O que é?', icon: FileText },
    { id: 'membro', title: 'Quem recebe?', icon: User },
    { id: 'tipo', title: 'Frequência', icon: RefreshCw },
    { id: 'data', title: 'Quando?', icon: Calendar },
    { id: 'revisao', title: 'Confirmação', icon: Check },
];

export function NewIncomeForm({ members, onSubmit, trigger }: NewIncomeFormProps) {
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
    } = useForm<IncomeFormValues>({
        resolver: zodResolver(incomeSchema),
        defaultValues: {
            tipo: IncomeType.FIXA,
            valor: 0,
        },
    });

    const formValues = watch();
    const watchMembroId = watch("membroId");

    useEffect(() => {
        if (open) {
            setStep(0);
            setDirection(0);
        }
    }, [open]);

    const selectedMemberName = useMemo(() => {
        const member = members.find((m) => m.id === watchMembroId);
        return member?.nome || (members.length === 0 ? watchMembroId : "");
    }, [watchMembroId, members]);

    const handleNext = async () => {
        let valid = false;

        switch (step) {
            case 0: valid = await validateField("valor"); break;
            case 1: valid = await validateField("descricao"); break;
            case 2: valid = await validateField("membroId"); break;
            case 3: valid = await validateField("tipo"); break;
            case 4:
                if (formValues.tipo === IncomeType.FIXA) valid = await validateField("dia_recorrencia");
                else valid = await validateField("data_recebimento");
                break;
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

    const handleFormSubmit = (data: IncomeFormValues) => {
        const memberName = members.length > 0
            ? members.find(m => m.id === data.membroId)?.nome || ""
            : data.membroId;

        onSubmit({
            descricao: data.descricao,
            valor: data.valor,
            membroId: data.membroId,
            tipo: data.tipo,
            data_recebimento: data.data_recebimento,
            dia_recorrencia: data.dia_recorrencia,
            membroNome: memberName,
        });

        setOpen(false);
        reset();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all">
                        <DollarSign className="h-5 w-5" />
                        Nova Receita
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
                    <form id="income-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">

                        {/* Passo 0: Valor */}
                        {step === 0 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-bold text-emerald-600">R$</span>
                                    <Input
                                        autoFocus
                                        id="valor"
                                        type="number"
                                        step="0.01"
                                        className="pl-14 text-4xl h-20 font-bold text-slate-800 bg-white border-none shadow-sm focus:ring-0"
                                        placeholder="0,00"
                                        {...register("valor", { valueAsNumber: true })}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNext())}
                                    />
                                </div>
                                {errors.valor && <p className="text-red-500 text-sm">{errors.valor.message}</p>}
                                <p className="text-center text-slate-500 text-sm">Digite o valor da receita</p>
                            </div>
                        )}

                        {/* Passo 1: Descrição */}
                        {step === 1 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <Input
                                    autoFocus
                                    id="descricao"
                                    placeholder="Ex: Salário, Freelance..."
                                    className="text-lg h-14 bg-white"
                                    {...register("descricao")}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNext())}
                                />
                                {errors.descricao && <p className="text-red-500 text-sm">{errors.descricao.message}</p>}
                            </div>
                        )}

                        {/* Passo 2: Membro */}
                        {step === 2 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <Label>Quem recebe?</Label>
                                {members.length > 0 ? (
                                    <Select onValueChange={(val) => setValue("membroId", val)} defaultValue={formValues.membroId}>
                                        <SelectTrigger className="h-14 text-lg bg-white">
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="eu">Eu</SelectItem>
                                            {members.map(m => (
                                                <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        autoFocus
                                        placeholder="Digite o nome (ex: João)"
                                        className="text-lg h-14 bg-white"
                                        {...register("membroId")}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNext())}
                                    />
                                )}
                                {errors.membroId && <p className="text-red-500 text-sm">{errors.membroId.message}</p>}
                            </div>
                        )}

                        {/* Passo 3: Tipo */}
                        {step === 3 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="grid grid-cols-2 gap-4">
                                    <div
                                        onClick={() => setValue("tipo", IncomeType.FIXA)}
                                        className={cn(
                                            "cursor-pointer p-6 rounded-xl border-2 transition-all text-center space-y-2",
                                            formValues.tipo === IncomeType.FIXA
                                                ? "bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500"
                                                : "bg-white border-slate-200 hover:border-emerald-200"
                                        )}
                                    >
                                        <RefreshCw className={cn("mx-auto h-8 w-8", formValues.tipo === IncomeType.FIXA ? "text-emerald-600" : "text-slate-400")} />
                                        <p className="font-semibold text-slate-700">Recorrente</p>
                                        <p className="text-xs text-slate-500">Todo mês (Salário, etc)</p>
                                    </div>
                                    <div
                                        onClick={() => setValue("tipo", IncomeType.SAZONAL)}
                                        className={cn(
                                            "cursor-pointer p-6 rounded-xl border-2 transition-all text-center space-y-2",
                                            formValues.tipo === IncomeType.SAZONAL
                                                ? "bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500"
                                                : "bg-white border-slate-200 hover:border-emerald-200"
                                        )}
                                    >
                                        <Calendar className={cn("mx-auto h-8 w-8", formValues.tipo === IncomeType.SAZONAL ? "text-emerald-600" : "text-slate-400")} />
                                        <p className="font-semibold text-slate-700">Única</p>
                                        <p className="text-xs text-slate-500">Apenas uma vez (Bônus, Venda)</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Passo 4: Data/Dia */}
                        {step === 4 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                {formValues.tipo === IncomeType.FIXA ? (
                                    <div className="space-y-2">
                                        <Label>Dia do pagamento (1-31)</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="31"
                                            autoFocus
                                            className="h-14 text-lg bg-white"
                                            placeholder="Ex: 5"
                                            {...register("dia_recorrencia", { valueAsNumber: true })}
                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNext())}
                                        />
                                        <p className="text-sm text-slate-500">O sistema gera automaticamente todo mês.</p>
                                        {errors.dia_recorrencia && <p className="text-red-500 text-sm">{errors.dia_recorrencia.message}</p>}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label>Data do recebimento</Label>
                                        <Input
                                            type="date"
                                            autoFocus
                                            className="h-14 text-lg bg-white"
                                            {...register("data_recebimento", { valueAsDate: true })}
                                        />
                                        {errors.data_recebimento && <p className="text-red-500 text-sm">{errors.data_recebimento.message}</p>}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Passo 5: Revisão */}
                        {step === 5 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                    <div className="flex justify-between items-center pb-4 border-b">
                                        <span className="text-slate-500">Valor</span>
                                        <span className="text-2xl font-bold text-emerald-600">
                                            R$ {formValues.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-slate-500 mb-1">Descrição</p>
                                            <p className="font-medium">{formValues.descricao}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-500 mb-1">Membro</p>
                                            <p className="font-medium">{selectedMemberName}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 mb-1">Tipo</p>
                                            <p className="font-medium">{IncomeTypeLabels[formValues.tipo]}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-500 mb-1">Data</p>
                                            <p className="font-medium">
                                                {formValues.tipo === IncomeType.FIXA
                                                    ? `Dia ${formValues.dia_recorrencia}`
                                                    : formValues.data_recebimento?.toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-center text-sm text-slate-500">
                                    Confirmar lançamento de receita?
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
                            form="income-form"
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

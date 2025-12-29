"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
    CardUser,
    TransactionFormData,
    PaymentMethod,
    TransactionType,
    Category,
    PaymentMethodLabels,
    TransactionTypeLabels,
    CategoryLabels,
} from "@/types";
import { calcularMesFatura } from "@/lib/invoiceUtils";
import { PlusCircle } from "lucide-react";

// Schema de validação com Zod
const transactionSchema = z.object({
    descricao: z.string().min(1, "Descrição é obrigatória"),
    valor: z.number().min(0.01, "Valor deve ser maior que zero"),
    categoria: z.nativeEnum(Category, {
        errorMap: () => ({ message: "Selecione uma categoria" }),
    }),
    data: z.date({
        required_error: "Data é obrigatória",
    }),
    tipo: z.nativeEnum(TransactionType, {
        errorMap: () => ({ message: "Selecione um tipo" }),
    }),
    metodo_pagamento: z.nativeEnum(PaymentMethod, {
        errorMap: () => ({ message: "Selecione um método de pagamento" }),
    }),
    card_id: z.string().optional(),
    user_id_gasto: z.string().optional(),
}).refine(
    (data) => {
        // Se o método de pagamento for cartão, card_id e user_id_gasto são obrigatórios
        if (data.metodo_pagamento === PaymentMethod.CARTAO_CREDITO) {
            return !!data.card_id && !!data.user_id_gasto;
        }
        return true;
    },
    {
        message: "Ao selecionar Cartão de Crédito, você deve escolher o cartão e o usuário",
        path: ["card_id"],
    }
);

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface NewExpenseFormProps {
    cards: Card[]; // Lista de cartões disponíveis
    onSubmit: (data: TransactionFormData & { mes_fatura?: string }) => void;
    trigger?: React.ReactNode; // Elemento customizado para abrir o modal
}

/**
 * Componente de formulário inteligente para cadastro de novas despesas
 * 
 * FUNCIONALIDADES PRINCIPAIS:
 * 1. Filtro inteligente de usuários: ao selecionar um cartão, exibe apenas os usuários vinculados
 * 2. Cálculo automático do mês da fatura baseado na data e dia de fechamento do cartão
 * 3. Validação completa de campos obrigatórios
 * 4. Interface responsiva com Shadcn/UI
 */
export function NewExpenseForm({ cards, onSubmit, trigger }: NewExpenseFormProps) {
    const [open, setOpen] = useState(false);
    const [selectedCardId, setSelectedCardId] = useState<string | undefined>();
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | undefined>();

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors },
    } = useForm<TransactionFormValues>({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            data: new Date(),
            tipo: TransactionType.VARIAVEL,
        },
    });

    // Observa mudanças no método de pagamento e no cartão selecionado
    const watchMetodoPagamento = watch("metodo_pagamento");
    const watchCardId = watch("card_id");
    const watchData = watch("data");

    // Atualiza o estado local quando o método de pagamento muda
    useEffect(() => {
        setSelectedPaymentMethod(watchMetodoPagamento);
        // Se mudar para Dinheiro/PIX, limpa os campos de cartão
        if (watchMetodoPagamento === PaymentMethod.DINHEIRO_PIX) {
            setValue("card_id", undefined);
            setValue("user_id_gasto", undefined);
            setSelectedCardId(undefined);
        }
    }, [watchMetodoPagamento, setValue]);

    // Atualiza o estado local quando o cartão selecionado muda
    useEffect(() => {
        setSelectedCardId(watchCardId);
        // Limpa o usuário selecionado quando o cartão muda
        if (watchCardId) {
            setValue("user_id_gasto", undefined);
        }
    }, [watchCardId, setValue]);

    // LÓGICA INTELIGENTE: Filtra usuários baseado no cartão selecionado
    const availableUsers = useMemo<CardUser[]>(() => {
        if (!selectedCardId) return [];

        const selectedCard = cards.find((card) => card.id === selectedCardId);
        return selectedCard?.users_assigned || [];
    }, [selectedCardId, cards]);

    // Cartão selecionado completo (para cálculo de fatura)
    const selectedCard = useMemo(() => {
        return cards.find((card) => card.id === selectedCardId);
    }, [selectedCardId, cards]);

    // Categorias filtradas por tipo de transação
    const availableCategories = useMemo(() => {
        const tipo = watch("tipo");

        if (tipo === TransactionType.RENDA) {
            return [
                Category.SALARIO,
                Category.FREELANCE,
                Category.INVESTIMENTOS,
                Category.OUTROS_RENDIMENTOS,
            ];
        } else if (tipo === TransactionType.CONTA_FIXA) {
            return [
                Category.ALUGUEL,
                Category.ENERGIA,
                Category.AGUA,
                Category.INTERNET,
                Category.TELEFONE,
                Category.CONDOMINIO,
                Category.ASSINATURAS,
            ];
        } else {
            return [
                Category.ALIMENTACAO,
                Category.TRANSPORTE,
                Category.SAUDE,
                Category.EDUCACAO,
                Category.LAZER,
                Category.VESTUARIO,
                Category.OUTROS,
            ];
        }
    }, [watch("tipo")]);

    const handleFormSubmit = (data: TransactionFormValues) => {
        let mesFatura: string | undefined;

        // Calcula o mês da fatura se for pagamento com cartão
        if (
            data.metodo_pagamento === PaymentMethod.CARTAO_CREDITO &&
            selectedCard &&
            data.data
        ) {
            mesFatura = calcularMesFatura(data.data, selectedCard.dia_fechamento);
        }

        // Envia os dados para o componente pai
        onSubmit({
            ...data,
            mes_fatura: mesFatura,
        });

        // Reseta o formulário e fecha o modal
        reset();
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="gap-2">
                        <PlusCircle className="h-4 w-4" />
                        Nova Saída
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Nova Saída</DialogTitle>
                    <DialogDescription>
                        Cadastre uma nova despesa ou conta. Os campos marcados com * são obrigatórios.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
                    {/* Descrição */}
                    <div className="space-y-2">
                        <Label htmlFor="descricao">Descrição *</Label>
                        <Input
                            id="descricao"
                            placeholder="Ex: Compra no supermercado"
                            {...register("descricao")}
                        />
                        {errors.descricao && (
                            <p className="text-sm text-red-500">{errors.descricao.message}</p>
                        )}
                    </div>

                    {/* Valor */}
                    <div className="space-y-2">
                        <Label htmlFor="valor">Valor (R$) *</Label>
                        <Input
                            id="valor"
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            {...register("valor", { valueAsNumber: true })}
                        />
                        {errors.valor && (
                            <p className="text-sm text-red-500">{errors.valor.message}</p>
                        )}
                    </div>

                    {/* Data */}
                    <div className="space-y-2">
                        <Label htmlFor="data">Data *</Label>
                        <Input
                            id="data"
                            type="date"
                            {...register("data", { valueAsDate: true })}
                        />
                        {errors.data && (
                            <p className="text-sm text-red-500">{errors.data.message}</p>
                        )}
                    </div>

                    {/* Tipo */}
                    <div className="space-y-2">
                        <Label htmlFor="tipo">Tipo *</Label>
                        <Select
                            onValueChange={(value) => setValue("tipo", value as TransactionType)}
                            defaultValue={TransactionType.VARIAVEL}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.values(TransactionType).map((tipo) => (
                                    <SelectItem key={tipo} value={tipo}>
                                        {TransactionTypeLabels[tipo]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.tipo && (
                            <p className="text-sm text-red-500">{errors.tipo.message}</p>
                        )}
                    </div>

                    {/* Categoria */}
                    <div className="space-y-2">
                        <Label htmlFor="categoria">Categoria *</Label>
                        <Select
                            onValueChange={(value) => setValue("categoria", value as Category)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableCategories.map((categoria) => (
                                    <SelectItem key={categoria} value={categoria}>
                                        {CategoryLabels[categoria]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.categoria && (
                            <p className="text-sm text-red-500">{errors.categoria.message}</p>
                        )}
                    </div>

                    {/* Método de Pagamento */}
                    <div className="space-y-2">
                        <Label htmlFor="metodo_pagamento">Método de Pagamento *</Label>
                        <Select
                            onValueChange={(value) =>
                                setValue("metodo_pagamento", value as PaymentMethod)
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o método" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.values(PaymentMethod).map((metodo) => (
                                    <SelectItem key={metodo} value={metodo}>
                                        {PaymentMethodLabels[metodo]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.metodo_pagamento && (
                            <p className="text-sm text-red-500">
                                {errors.metodo_pagamento.message}
                            </p>
                        )}
                    </div>

                    {/* SEÇÃO CONDICIONAL: Cartão de Crédito */}
                    {selectedPaymentMethod === PaymentMethod.CARTAO_CREDITO && (
                        <>
                            {/* Seleção de Cartão */}
                            <div className="space-y-2">
                                <Label htmlFor="card_id">Cartão *</Label>
                                <Select
                                    onValueChange={(value) => setValue("card_id", value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o cartão" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {cards.map((card) => (
                                            <SelectItem key={card.id} value={card.id}>
                                                {card.nome_cartao} (Limite: R${" "}
                                                {card.limite.toLocaleString("pt-BR")})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.card_id && (
                                    <p className="text-sm text-red-500">{errors.card_id.message}</p>
                                )}
                            </div>

                            {/* FILTRO INTELIGENTE: Usuários do Cartão Selecionado */}
                            {selectedCardId && availableUsers.length > 0 && (
                                <div className="space-y-2">
                                    <Label htmlFor="user_id_gasto">Usuário do Cartão *</Label>
                                    <Select
                                        onValueChange={(value) => setValue("user_id_gasto", value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Quem realizou a compra?" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableUsers.map((user) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    {user.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.user_id_gasto && (
                                        <p className="text-sm text-red-500">
                                            {errors.user_id_gasto.message}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Informação sobre a fatura */}
                            {selectedCard && watchData && (
                                <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
                                    <p className="font-medium">📅 Informação da Fatura:</p>
                                    <p className="mt-1">
                                        Esta compra será incluída na fatura de{" "}
                                        <strong>
                                            {calcularMesFatura(watchData, selectedCard.dia_fechamento)}
                                        </strong>
                                    </p>
                                    <p className="mt-1 text-xs text-blue-700">
                                        Dia de fechamento: {selectedCard.dia_fechamento} | Vencimento:{" "}
                                        {selectedCard.dia_vencimento}
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                reset();
                                setOpen(false);
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit">Salvar Despesa</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}


import { motion, PanInfo, useAnimation } from "framer-motion";
import { Transaction, TransactionType, PaymentMethod, CategoryLabels } from "@/types";
import { format } from "date-fns";
import { Edit2, Trash2, User, UserPlus } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface SwipeableTransactionItemProps {
    item: Transaction;
    onEdit: (item: Transaction) => void;
    onDelete: (item: Transaction) => void;
    onAssign: (item: Transaction) => void; // Trigger Assign Dialog
    showAssign: boolean; // Only if Card
    assignedName?: string;
    displayValue?: number;
    installmentText?: string;
    memberColor?: string;
}

export function SwipeableTransactionItem({
    item,
    onEdit,
    onDelete,
    onAssign,
    showAssign,
    assignedName,
    displayValue,
    installmentText,
    memberColor
}: SwipeableTransactionItemProps) {
    const controls = useAnimation();
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        const check = () => setIsDesktop(window.innerWidth >= 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const handleDragEnd = async (event: any, info: PanInfo) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;

        // If swiped left significantly
        if (offset < -50 || velocity < -500) {
            controls.start({ x: -180 }); // Reveal actions
        } else {
            controls.start({ x: 0 }); // Close
        }
    };

    // Determine colors
    const isIncome = item.tipo === TransactionType.RENDA;
    const isCredit = item.metodo_pagamento === PaymentMethod.CARTAO_CREDITO;

    // Add missing prop logic or default
    const finalDisplayValue = displayValue ?? item.valor;

    return (
        <div className="relative overflow-hidden mb-2 rounded-xl bg-slate-100 group">
            {/* Background Actions Layer - MOBILE ONLY */}
            {/* Background Actions Layer - MOBILE ONLY */}
            <div className="absolute inset-0 flex flex-row-reverse items-center h-full md:hidden">
                {/* Delete */}
                <button
                    onClick={() => onDelete(item)}
                    className="h-full w-[60px] bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
                >
                    <Trash2 className="h-5 w-5" />
                </button>

                {/* Edit */}
                <button
                    onClick={() => onEdit(item)}
                    className="h-full w-[60px] bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors"
                >
                    <Edit2 className="h-5 w-5" />
                </button>

                {/* Assign Member (Only for Cards) */}
                {showAssign && (
                    <button
                        onClick={() => onAssign(item)}
                        className="h-full w-[60px] bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white transition-colors"
                    >
                        {item.user_id_gasto ? <User className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                    </button>
                )}
            </div>

            {/* Foreground Content Layer */}
            <motion.div
                drag={isDesktop ? false : "x"}
                dragConstraints={{ left: -180, right: 0 }}
                dragElastic={0.1}
                animate={controls}
                onDragEnd={handleDragEnd}
                style={{ borderLeftColor: memberColor || 'transparent', borderLeftWidth: memberColor ? '4px' : '1px' }}
                className={`bg-white p-4 relative z-10 shadow-sm border border-slate-100 rounded-xl flex justify-between items-center ${memberColor ? 'pl-3' : ''}`}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-full ${isIncome ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-500'}`}>
                        {isIncome ? '💰' : isCredit ? '💳' : '💸'}
                    </div>
                    <div>
                        <p className="font-semibold text-slate-800 line-clamp-1">{item.descricao}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{CategoryLabels[item.categoria]}</span>
                            <span>•</span>
                            <span>{format(item.data, "dd MMM", { locale: ptBR })}</span>

                            {/* Member Name Badge */}
                            {assignedName && (
                                <span
                                    className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1"
                                    style={{ color: memberColor || undefined, backgroundColor: memberColor ? `${memberColor}15` : undefined }}
                                >
                                    <User className="h-3 w-3" />
                                    {assignedName.split(" ")[0]}
                                </span>
                            )}
                            {/* Installment Text for Desktop/Mobile integration */}
                            {(installmentText || item.parcelado) && (
                                <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded flex items-center border border-blue-100 font-medium">
                                    {installmentText || `${item.parcela_atual}/${item.numero_parcelas}`}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="text-right flex items-center gap-4">
                    <div>
                        <p className={`font-bold ${isIncome ? 'text-green-600' : 'text-slate-800'}`}>
                            {isIncome ? '+ ' : ''}R$ {finalDisplayValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                    </div>

                    {/* DESKTOP ACTIONS - Hidden on Mobile */}
                    <div className="hidden md:flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                                className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            >
                                <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            {showAssign && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => { e.stopPropagation(); onAssign(item); }}
                                    className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                    title="Atribuir Membro"
                                >
                                    {item.user_id_gasto ? <User className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                                </Button>
                            )}
                        </div>
                        {assignedName && (
                            <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap pr-1">
                                {assignedName}
                            </span>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

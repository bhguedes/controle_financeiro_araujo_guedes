import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, Category, Transaction, TransactionType, PaymentMethod, CategoryLabels } from "@/types";
import { Upload, FileUp, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Papa from "papaparse";
import { addTransaction } from "@/services/financeService";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";

interface CsvImporterProps {
    cards: Card[];
    onSuccess: () => void;
    trigger?: React.ReactNode;
}

interface ImportedItem {
    id: string; // Temp ID for list
    data: Date;
    descricao: string;
    valor: number;
    categoria: Category;
    selected: boolean;
    parcelado: boolean;
    parcela_atual?: number;
    numero_parcelas?: number;
}

export function CsvImporter({ cards, onSuccess, trigger }: CsvImporterProps) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [selectedCardId, setSelectedCardId] = useState<string>("");
    const [file, setFile] = useState<File | null>(null);
    const [items, setItems] = useState<ImportedItem[]>([]);
    const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            parseFile(e.target.files[0]);
        }
    };

    const parseFile = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const parsedItems: ImportedItem[] = results.data.map((row: any, index) => {
                        // Normalize keys (lowercase)
                        const normalizedRow: any = {};
                        Object.keys(row).forEach(key => {
                            normalizedRow[key.toLowerCase().trim()] = row[key];
                        });

                        // Extract Data
                        // Accepts: DD/MM/YYYY, YYYY-MM-DD or DD/mmm (19/dez)
                        let dateStr = normalizedRow["data"] || normalizedRow["date"] || "";
                        let dateObj = new Date();

                        const monthMap: { [key: string]: number } = {
                            "jan": 0, "fev": 1, "mar": 2, "abr": 3, "mai": 4, "jun": 5,
                            "jul": 6, "ago": 7, "set": 8, "out": 9, "nov": 10, "dez": 11
                        };

                        if (/\d{1,2}\/[a-z]{3}/i.test(dateStr)) {
                            // Format: 19/dez
                            const [dayStr, monthStr] = dateStr.toLowerCase().split("/");
                            const monthIndex = monthMap[monthStr];
                            if (monthIndex !== undefined) {
                                const currentYear = new Date().getFullYear();
                                dateObj = new Date(currentYear, monthIndex, parseInt(dayStr));

                                // Heuristic: If date is > 180 days in future, assume previous year
                                const now = new Date();
                                const diffTime = dateObj.getTime() - now.getTime();
                                const diffDays = diffTime / (1000 * 3600 * 24);
                                if (diffDays > 180) {
                                    dateObj.setFullYear(currentYear - 1);
                                }
                            }
                        } else if (dateStr.includes("/")) {
                            const [day, month, year] = dateStr.split("/");
                            dateObj = new Date(Number(year), Number(month) - 1, Number(day));
                        } else if (dateStr) {
                            dateObj = new Date(dateStr);
                        }

                        // Extract Value
                        let valStr = normalizedRow["valor"] || normalizedRow["value"] || normalizedRow["amount"] || "0";
                        if (typeof valStr === "string") {
                            // Remove "R$", spaces
                            valStr = valStr.replace(/[R$\s]/g, "");
                            // If contains comma, assume brazilian format (replace dot with empty, comma with dot)
                            // BUT be careful with "1.200,50" -> "1200.50"
                            if (valStr.includes(",") && valStr.includes(".")) {
                                valStr = valStr.replace(/\./g, "").replace(",", ".");
                            } else if (valStr.includes(",")) {
                                valStr = valStr.replace(",", ".");
                            }
                        }
                        const valor = parseFloat(valStr);

                        // Extract Description
                        const descricao = normalizedRow["descricao"] || normalizedRow["description"] || normalizedRow["loja"] || "Compra Importada";

                        // Default Category
                        const categoria = Category.OUTROS;

                        // Extract Installments (Parcelas)
                        let parcelado = false;
                        let parcela_atual = undefined;
                        let numero_parcelas = undefined;

                        // Priority: Check regex X/Y in "parcela_atual" or "parcela"
                        const pAtualCol = normalizedRow["parcela_atual"];
                        const pGeneralCol = normalizedRow["parcela"] || normalizedRow["parcelas"] || normalizedRow["installments"];

                        // User example: parcela_atual="1/1", parcelas="1"
                        // Or: parcela_atual="09/10", parcelas="10"

                        // Strategy: Look for X/Y pattern first in the most specific column
                        // This Regex handles: "09/10", "9 de 10", "1/12"
                        // Also handles Excel export artifacts like: ="09/10" (ignores the ="...")
                        const patternStr = pAtualCol || pGeneralCol || "";
                        const match = patternStr.toString().match(/(\d+)\s*(?:\/|\sde\s)\s*(\d+)/i);

                        if (match) {
                            parcela_atual = parseInt(match[1]);
                            numero_parcelas = parseInt(match[2]);
                            if (numero_parcelas > 1) parcelado = true;
                        } else {
                            // Fallback: separate columns numeric values
                            const pTotal = normalizedRow["total_parcelas"] || normalizedRow["numero_parcelas"] || normalizedRow["parcelas"]; // "parcelas" might be total

                            // Only if pAtualCol is just a number (no slash) and pTotal is defined
                            if (pAtualCol && !isNaN(parseInt(pAtualCol)) && pTotal) {
                                parcela_atual = parseInt(pAtualCol);
                                numero_parcelas = parseInt(pTotal);
                                if (numero_parcelas > 1) parcelado = true;
                            }
                        }

                        return {
                            id: `item-${index}`,
                            data: dateObj,
                            descricao: descricao.trim(),
                            valor: isNaN(valor) ? 0 : Math.abs(valor), // Ensure positive for expenses logic
                            categoria,
                            selected: true,
                            parcelado,
                            parcela_atual,
                            numero_parcelas
                        };
                    });

                    // Filter invalid items
                    const validItems = parsedItems.filter(i => i.valor > 0 && !isNaN(i.data.getTime()));

                    if (validItems.length === 0) {
                        setError("Nenhum item válido encontrado no CSV. Verifique o padrão.");
                        return;
                    }

                    setItems(validItems);
                    setStep("preview");

                } catch (err) {
                    console.error(err);
                    setError("Erro ao processar o arquivo. Verifique o formato.");
                }
            },
            error: (err) => {
                setError("Erro ao ler o arquivo: " + err.message);
            }
        });
    };

    const handleImport = async () => {
        if (!user || !selectedCardId) return;

        setStep("importing");
        try {
            const selectedItems = items.filter(i => i.selected);

            // We use a loop for now. Ideally batch write, but service uses addTransaction logic.
            for (const item of selectedItems) {
                await addTransaction(user.uid, {
                    descricao: item.descricao,
                    valor: item.valor,
                    categoria: item.categoria,
                    data: item.data, // Service handles Timestamp conversion
                    tipo: TransactionType.VARIAVEL,
                    metodo_pagamento: PaymentMethod.CARTAO_CREDITO,
                    card_id: selectedCardId,
                    parcelado: item.parcelado,
                    parcela_atual: item.parcela_atual,
                    numero_parcelas: item.numero_parcelas,
                    is_recurring: false
                    // status defaults to completed
                });
            }

            alert(`${selectedItems.length} despesas importadas com sucesso!`);
            onSuccess();
            setOpen(false);
            resetState();

        } catch (error) {
            console.error(error);
            setError("Erro ao salvar transações.");
            setStep("preview");
        }
    };

    const resetState = () => {
        setFile(null);
        setItems([]);
        setStep("upload");
        setError(null);
        setSelectedCardId("");
    };



    const toggleSelection = (id: string) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
    };

    const totalSelected = items.filter(i => i.selected).reduce((acc, i) => acc + i.valor, 0);

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) resetState();
        }}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="gap-2">
                        <Upload className="h-4 w-4" /> Importar CSV
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Importar Fatura de Cartão</DialogTitle>
                    <DialogDescription>
                        Faça upload de um arquivo .CSV contendo suas despesas.<br />
                        <span className="text-xs text-slate-400">Colunas: Data, Descrição, Valor, Categoria, Parcela (ex: 1/10)</span>
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-md flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                    </div>
                )}

                {step === "upload" && (
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">1. Selecione o Cartão de Destino</label>
                            <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um cartão..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {cards.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.nome_cartao}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedCardId && (
                            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors relative">
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center gap-2 text-slate-500">
                                    <FileUp className="h-8 w-8 text-slate-400" />
                                    <p className="font-medium text-slate-700">Clique para selecionar o arquivo CSV</p>
                                    <p className="text-xs">Colunas esperadas: data, descricao, valor, parcela (opcional)</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {step === "preview" && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-slate-800">Pré-visualização</h3>
                            <span className="text-sm font-medium bg-green-100 text-green-800 px-3 py-1 rounded-full">
                                Total: R$ {totalSelected.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                        </div>

                        <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="p-3 w-[50px]">
                                            <input
                                                type="checkbox"
                                                checked={items.every(i => i.selected)}
                                                onChange={() => {
                                                    const allSelected = items.every(i => i.selected);
                                                    setItems(prev => prev.map(i => ({ ...i, selected: !allSelected })));
                                                }}
                                                className="rounded border-slate-300"
                                            />
                                        </th>
                                        <th className="p-3 font-medium text-slate-600">Desde</th>
                                        <th className="p-3 font-medium text-slate-600">Descrição</th>
                                        <th className="p-3 font-medium text-slate-600">Parc.</th>
                                        <th className="p-3 font-medium text-slate-600">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item) => (
                                        <tr key={item.id} className={`hover:bg-slate-50 ${!item.selected ? "opacity-50" : ""}`}>
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={item.selected}
                                                    onChange={() => toggleSelection(item.id)}
                                                    className="rounded border-slate-300"
                                                />
                                            </td>
                                            <td className="p-3">{format(item.data, "dd/MM/yyyy")}</td>
                                            <td className="p-3 font-medium text-slate-900">{item.descricao}</td>
                                            <td className="p-3 text-slate-500 text-xs">
                                                {item.parcelado ? `${item.parcela_atual}/${item.numero_parcelas}` : "-"}
                                            </td>
                                            <td className="p-3">R$ {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {step === "importing" && (
                    <div className="py-12 text-center flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                        <p className="text-slate-600">Salvando as despesas, aguarde...</p>
                    </div>
                )}

                <DialogFooter>
                    {step === "preview" && (
                        <>
                            <Button variant="ghost" onClick={resetState}>Cancelar</Button>
                            <Button onClick={handleImport} className="bg-green-600 hover:bg-green-700">
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Confirmar Importação
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

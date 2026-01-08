import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, Category, Transaction, TransactionType, PaymentMethod, CategoryLabels } from "@/types";
import { Upload, FileUp, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Papa from "papaparse";
import { addTransaction } from "@/services/financeService";
import { useAuth } from "@/context/AuthContext";
import { format, addMonths } from "date-fns";

interface CsvImporterProps {
    cards: Card[];
    onSuccess: () => void;
    trigger?: React.ReactNode;
    monthReference?: Date; // Optional to avoid breaking other usages, but recommended
}

interface ImportedItem {
    id: string; // Temp ID for list
    data: Date;
    descricao: string;
    valor: number;
    categoria: Category;
    tipo: TransactionType;
    selected: boolean;
    parcelado: boolean;
    parcela_atual?: number;
    numero_parcelas?: number;
}

export function CsvImporter({ cards, onSuccess, trigger, monthReference }: CsvImporterProps) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [selectedCardId, setSelectedCardId] = useState<string>("");
    const [file, setFile] = useState<File | null>(null);
    const [items, setItems] = useState<ImportedItem[]>([]);
    const [usePurchaseDate, setUsePurchaseDate] = useState(false); // Default false for Invoice Import
    const [generateFuture, setGenerateFuture] = useState(true); // Default true for convenience
    const [generatePast, setGeneratePast] = useState(false); // Default false (safety)
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
                        // Normalize keys (lowercase) and sanitize values (remove Excel artifacts)
                        // Normalize keys (lowercase) and sanitize values (remove Excel artifacts)
                        const normalizedRow: any = {};
                        Object.keys(row).forEach(key => {
                            let cleanKey = key.trim();
                            // Remove BOM (Zero Width No-Break Space)
                            if (cleanKey.charCodeAt(0) === 0xFEFF) {
                                cleanKey = cleanKey.slice(1);
                            }
                            // Remove quotes from key
                            cleanKey = cleanKey.replace(/^["']|["']$/g, '');

                            let val = row[key];
                            if (typeof val === 'string') {
                                val = val.trim();
                                // Remove ="..." wrapper often found in Excel CSV exports
                                // Example: "=""1/1""" -> "1/1"
                                if (val.startsWith('="') && val.endsWith('"')) {
                                    val = val.substring(2, val.length - 1);
                                }
                            }
                            normalizedRow[cleanKey.toLowerCase()] = val;
                        });

                        // Extract Data
                        // Accepts: DD/MM/YYYY, YYYY-MM-DD or DD/mmm (19/dez)
                        // Extract Data
                        // Accepts: DD/MM/YYYY, YYYY-MM-DD or DD/mmm (19/dez)
                        // Keys normalized to lowercase
                        let dateStr = normalizedRow["data"] || normalizedRow["date"] || normalizedRow["dia"] || normalizedRow["dt"] || "";
                        let dateObj: Date | null = null;

                        const monthMap: { [key: string]: number } = {
                            "jan": 0, "fev": 1, "mar": 2, "abr": 3, "mai": 4, "jun": 5,
                            "jul": 6, "ago": 7, "set": 8, "out": 9, "nov": 10, "dez": 11
                        };

                        if (!dateStr) {
                            dateObj = new Date(); // Fallback to today if missing
                        } else if (/\d{1,2}\/[a-z]{3}/i.test(dateStr)) {
                            // Format: 19/dez
                            const [dayStr, monthStr] = dateStr.toLowerCase().split("/");
                            const monthIndex = monthMap[monthStr];
                            if (monthIndex !== undefined) {
                                const currentYear = new Date().getFullYear();
                                dateObj = new Date(currentYear, monthIndex, parseInt(dayStr));

                                // Heuristic: If date is very far in future, assume previous year
                                const now = new Date();
                                if (dateObj > new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)) {
                                    dateObj.setFullYear(currentYear - 1);
                                }
                            }
                        } else if (dateStr.includes("/")) {
                            // Handle DD/MM/YYYY, DD/MM/YY, DD/MM
                            const parts = dateStr.split("/");
                            const day = parseInt(parts[0]);
                            const month = parseInt(parts[1]) - 1;
                            let year = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();

                            // Fix 2-digit year
                            if (year < 100) year += 2000;

                            dateObj = new Date(year, month, day);

                            // If no year provided, check heuristic
                            if (parts.length === 2) {
                                const now = new Date();
                                if (dateObj > new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)) {
                                    dateObj.setFullYear(year - 1);
                                }
                            }
                        } else {
                            // Try generic parse (YYYY-MM-DD often works)
                            // Append time to avoid UTC shift if it looks like ISO
                            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                                dateObj = new Date(dateStr + "T12:00:00");
                            } else {
                                dateObj = new Date(dateStr);
                            }
                        }

                        if (!dateObj || isNaN(dateObj.getTime())) {
                            console.warn("Invalid date parsed, defaulting to today:", dateStr);
                            dateObj = new Date();
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
                        // Strategy: Look for X/Y pattern first in the most specific column, THEN in Description
                        const patternStr = pAtualCol || pGeneralCol || "";
                        let match = patternStr.toString().match(/(\d+)\s*(?:\/|\sde\s)\s*(\d+)/i);

                        // If not found in columns, look in Description (e.g. "Store 01/05")
                        if (!match) {
                            // Match "01/05", "1/5", "1 de 5"
                            // "ZP*FRANCISC -CT 3 01/05 (1/1)" -> "01/05"
                            // "MERCADO*MERCADOLIV02/03" -> "02/03" (No space)
                            const descMatch = descricao.match(/(\d{1,2})\s*(?:\/|\sde\s)\s*(\d{1,2})/i);
                            if (descMatch) {
                                const cur = parseInt(descMatch[1]);
                                const tot = parseInt(descMatch[2]);
                                // Heuristic: Current <= Total AND Total <= 60 (Installments usually < 60)
                                // AND Total > 1 (1/1 is trivial, but okay)
                                // Avoid matching "29/12" (29 > 12 -> Invalid)
                                if (cur <= tot && tot > 1 && tot <= 60) {
                                    match = descMatch;
                                }
                            }
                        }

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

                        if (index === 0) {
                            console.log("First Row Debug:", {
                                raw: row,
                                normalized: normalizedRow,
                                dateStr,
                                dateObj,
                                valStr,
                                valor
                            });
                        }

                        // Analisar sinal para definir Tipo (Despesa vs Renda/Estorno)
                        let finalValor = valor;
                        let finalTipo = TransactionType.VARIAVEL;

                        if (valor < 0) {
                            finalValor = Math.abs(valor);
                            finalTipo = TransactionType.RENDA;
                        }

                        // CONTEXT-AWARE DATE OVERRIDE (User Request)
                        // If monthReference is provided AND it is an installment > 1/1
                        // We force the date to be in the Selected Month
                        if (monthReference && numero_parcelas && numero_parcelas > 1 && dateObj) {
                            const refDate = new Date(monthReference);
                            const originalDay = dateObj.getDate();
                            // Force Month/Year to Reference. 
                            // Keep original Day.
                            dateObj = new Date(refDate.getFullYear(), refDate.getMonth(), originalDay, 12, 0, 0);
                        }

                        return {
                            id: `item-${index}`,
                            data: dateObj,
                            descricao: descricao.trim(),
                            valor: finalValor,
                            categoria,
                            tipo: finalTipo,
                            selected: true,
                            parcelado,
                            parcela_atual,
                            numero_parcelas
                        };
                    });

                    // Filter invalid items (allow negatives, just not zero or invalid date)
                    const validItems = parsedItems.filter(i => i.valor !== 0 && !isNaN(i.data.getTime()));

                    // Deduplicate Installments (Keep only distinct purchases)
                    // If multiple rows refer to same purchase (e.g. Parcela 1/10 and 2/10), keep only the one with lowest index.
                    const uniqueItems: ImportedItem[] = [];
                    const installmentMap = new Map<string, ImportedItem>();

                    validItems.forEach(item => {
                        if (item.parcelado && item.numero_parcelas && item.numero_parcelas > 1) {
                            // Generate Signature: Date + CleanDesc + Value + TotalParcelas
                            // Remove "01/10", "1/10", "1 de 10" from description
                            const cleanDesc = item.descricao.replace(/(\d+)\s*(?:\/|\sde\s)\s*(\d+)/gi, "").trim();
                            const key = `${item.data.toISOString()}_${cleanDesc}_${item.valor}_${item.numero_parcelas}`;

                            if (!installmentMap.has(key)) {
                                installmentMap.set(key, item);
                            } else {
                                const existing = installmentMap.get(key)!;
                                // Keep the one with lower startP (e.g. 1/10 is better than 5/10 to be the "seed")
                                if ((item.parcela_atual || 999) < (existing.parcela_atual || 999)) {
                                    installmentMap.set(key, item);
                                }
                            }
                        } else {
                            // Non-installments: Keep all (allow duplicates like 2 Uber rides)
                            uniqueItems.push(item);
                        }
                    });

                    // Add deduplicated installments back
                    uniqueItems.push(...installmentMap.values());

                    // Sort by date/desc for nice preview
                    uniqueItems.sort((a, b) => a.data.getTime() - b.data.getTime());

                    if (uniqueItems.length === 0) {
                        setError("Nenhum item válido encontrado no CSV. Verifique o padrão.");
                        return;
                    }

                    setItems(uniqueItems);
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
            // We use a loop for now. Ideally batch write, but service uses addTransaction logic.
            for (const item of selectedItems) {
                // Pass RAW data (Purchase Date) if usePurchaseDate is true. Service handles the offset.
                await addTransaction(user.uid, {
                    descricao: item.descricao,
                    valor: item.valor,
                    categoria: item.categoria,
                    data: item.data, // Raw date (Purchase Date or Invoice Date)
                    tipo: item.tipo,
                    metodo_pagamento: PaymentMethod.CARTAO_CREDITO,
                    card_id: selectedCardId,
                    parcelado: item.parcelado,
                    parcela_atual: item.parcela_atual,
                    numero_parcelas: item.numero_parcelas,
                    is_recurring: false
                    // status defaults to completed
                }, {
                    generate_future_installments: generateFuture,
                    use_purchase_date_logic: usePurchaseDate,
                    backfill_past_installments: generatePast
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
        setUsePurchaseDate(true);
        setGenerateFuture(false);
        setStep("upload");
        setError(null);
        setSelectedCardId("");
    };



    const toggleSelection = (id: string) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
    };

    const totalSelected = items.filter(i => i.selected).reduce((acc, i) => acc + (i.tipo === TransactionType.RENDA ? -i.valor : i.valor), 0);

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
                                            <td className="p-3">
                                                {format(item.data, "dd/MM/yyyy")}
                                                {monthReference && item.parcelado && (item.numero_parcelas || 0) > 1 && (
                                                    <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded ml-2" title="Data ajustada para o mês selecionado">
                                                        Mês Atual
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 font-medium text-slate-900">{item.descricao}</td>
                                            <td className="p-3 text-slate-500 text-xs">
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        className="w-8 h-6 text-center border rounded p-0 text-xs"
                                                        value={item.parcela_atual || ""}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value);
                                                            setItems(prev => prev.map(i => i.id === item.id ? { ...i, parcela_atual: isNaN(val) ? undefined : val, parcelado: (isNaN(val) ? ((i.numero_parcelas ?? 0) > 1) : true) } : i));
                                                        }}
                                                        placeholder="1"
                                                    />
                                                    <span>/</span>
                                                    <input
                                                        type="number"
                                                        className="w-8 h-6 text-center border rounded p-0 text-xs"
                                                        value={item.numero_parcelas || ""}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value);
                                                            setItems(prev => prev.map(i => i.id === item.id ? {
                                                                ...i,
                                                                numero_parcelas: isNaN(val) ? undefined : val,
                                                                parcelado: !isNaN(val) && val > 1
                                                            } : i));
                                                        }}
                                                        placeholder="1"
                                                    />
                                                </div>
                                            </td>
                                            <td className={`p-3 font-medium ${item.tipo === TransactionType.RENDA ? "text-green-600" : "text-red-600"}`}>
                                                {item.tipo === TransactionType.RENDA ? "+" : "-"} R$ {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <input
                                type="checkbox"
                                id="usePurchaseDate"
                                checked={usePurchaseDate}
                                onChange={(e) => setUsePurchaseDate(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="usePurchaseDate" className="text-sm text-slate-700 cursor-pointer select-none">
                                <strong>Considerar data como "Data da Compra":</strong> recalcular meses para parcelas futuras (ex: Parcela 2/10 vira Mês Seguinte)
                            </label>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2">
                            <input
                                type="checkbox"
                                id="generateFuture"
                                checked={generateFuture}
                                onChange={(e) => setGenerateFuture(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="generateFuture" className="text-sm text-slate-700 cursor-pointer select-none">
                                <strong>Gerar parcelas futuras restantes?</strong> (Importar Fatura Mensal e projetar meses seguintes automaticamente)
                            </label>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2">
                            <input
                                type="checkbox"
                                id="generatePast"
                                checked={generatePast}
                                onChange={(e) => setGeneratePast(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="generatePast" className="text-sm text-slate-700 cursor-pointer select-none">
                                <strong>Gerar parcelas passadas?</strong> (Ex: Importar parcela 2/4 e criar automaticamente a 1/4 no mês anterior)
                                <div className="text-xs text-amber-600 mt-1">⚠️ Cuidado: Se você já importou a parcela 1 anteriormente, não marque isso (gera duplicidade).</div>
                            </label>
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

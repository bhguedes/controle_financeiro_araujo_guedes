
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardUser } from "@/types";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

interface AssignMemberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    card: Card | undefined;
    selectedMemberId?: string | null;
    onAssign: (memberId: string) => void;
    currentUserId: string;
    forcedMembers?: CardUser[];
    title?: string;
}

export function AssignMemberDialog({
    open,
    onOpenChange,
    card,
    selectedMemberId,
    onAssign,
    currentUserId,
    forcedMembers,
    title
}: AssignMemberDialogProps) {

    if (!card && !forcedMembers) return null;

    // Build member list
    let members: CardUser[] = [];

    if (forcedMembers) {
        // Use forced list directly (add "Me" if needed, but usually passed list typically includes aggregation)
        // Check if "Me" is in forcedMembers, if not, maybe add? 
        // For Bulk Assign, caller passed 'allUniqueMembers'.
        // If 'forcedMembers' is raw CardUser list from cards, it might lack 'user.uid' as 'Me' if 'Me' is implicitly the owner not listed in users_assigned.
        // But usually 'users_assigned' contains invited members. Owner is separate?
        // Let's assume passed list is complete or we just use it.
        members = forcedMembers;

        // Ensure "Me" is there if currentUserId is not found?
        // Actually, in DespesasPage, I aggregated from `users_assigned`. 
        // Does `users_assigned` include the owner? In `getCards`, we likely manually add owner logic or it's separate.
        // In `FinanceService`, `users_assigned` are the invitees.
        // So I should PREPEND "Me" here if not present.
        const hasMe = members.some(m => m.id === currentUserId);
        if (!hasMe) {
            members = [
                { id: currentUserId, nome: "Eu (Titular)", card_id: "", created_at: new Date() },
                ...members
            ];
        }
    } else if (card) {
        members = [
            {
                id: currentUserId,
                nome: "Eu (Titular)",
                card_id: card.id,
                created_at: new Date()
            },
            ...(card.users_assigned?.filter(u => u.id !== currentUserId) || [])
        ];
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl font-bold flex items-center justify-center gap-2">
                        <User className="h-6 w-6 text-emerald-600" />
                        {title || "Quem comprou?"}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-3 py-4">
                    {members.map(member => (
                        <button
                            key={member.id}
                            onClick={() => {
                                onAssign(member.id);
                                onOpenChange(false);
                            }}
                            className={cn(
                                "flex items-center gap-3 p-4 rounded-xl border-2 transition-all hover:bg-slate-50",
                                selectedMemberId === member.id
                                    ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                                    : "border-slate-200"
                            )}
                        >
                            <div className={cn(
                                "p-2 rounded-full",
                                selectedMemberId === member.id ? "bg-emerald-200 text-emerald-700" : "bg-slate-100 text-slate-500"
                            )}>
                                <User className="h-5 w-5" />
                            </div>
                            <span className={cn(
                                "font-medium text-lg",
                                selectedMemberId === member.id ? "text-emerald-900" : "text-slate-700"
                            )}>
                                {member.nome}
                            </span>
                        </button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

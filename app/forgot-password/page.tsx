"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { KeyRound, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");
        setError("");

        try {
            auth.languageCode = 'pt-BR'; // Força o envio em português
            await sendPasswordResetEmail(auth, email);
            setMessage("Email de redefinição enviado! Verifique sua caixa de entrada.");
        } catch (error: any) {
            console.error("Erro ao resetar senha:", error);
            if (error.code === "auth/user-not-found") {
                setError("Email não encontrado.");
            } else if (error.code === "auth/invalid-email") {
                setError("Email inválido.");
            } else {
                setError("Erro ao enviar email. Tente novamente.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
                            <KeyRound className="h-8 w-8 text-emerald-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">
                            Recuperar Senha
                        </h1>
                        <p className="text-slate-600 text-sm">
                            Digite seu email para receber um link de redefinição
                        </p>
                    </div>

                    <form onSubmit={handleReset} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Cadastrado</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>

                        {message && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <p className="text-sm text-green-800">{message}</p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={loading || !!message}
                        >
                            {loading ? "Enviando..." : "Enviar Link de Recuperação"}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link
                            href="/login"
                            className="inline-flex items-center text-sm text-slate-500 hover:text-emerald-600 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Voltar para o Login
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}

"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { UserPlus } from "lucide-react";

export default function RegisterPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validações
        if (password !== confirmPassword) {
            setError("As senhas não coincidem.");
            return;
        }

        if (password.length < 6) {
            setError("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        setLoading(true);

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            router.push("/");
        } catch (error: any) {
            console.error("Erro ao criar conta:", error);

            // Mensagens de erro em português
            if (error.code === "auth/email-already-in-use") {
                setError("Este email já está cadastrado.");
            } else if (error.code === "auth/invalid-email") {
                setError("Email inválido.");
            } else if (error.code === "auth/weak-password") {
                setError("Senha muito fraca. Use pelo menos 6 caracteres.");
            } else {
                setError("Erro ao criar conta. Tente novamente.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-purple-50 via-slate-50 to-blue-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                            <UserPlus className="h-8 w-8 text-purple-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">
                            Criar Conta
                        </h1>
                        <p className="text-slate-600">
                            Comece a gerenciar suas finanças hoje mesmo
                        </p>
                    </div>

                    {/* Formulário */}
                    <form onSubmit={handleRegister} className="space-y-4">
                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
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

                        {/* Senha */}
                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={loading}
                            />
                            <p className="text-xs text-slate-500">
                                Mínimo de 6 caracteres
                            </p>
                        </div>

                        {/* Confirmar Senha */}
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>

                        {/* Mensagem de Erro */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        {/* Botão de Registro */}
                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            disabled={loading}
                        >
                            {loading ? "Criando conta..." : "Criar Conta"}
                        </Button>
                    </form>

                    {/* Link para Login */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-slate-600">
                            Já tem uma conta?{" "}
                            <Link
                                href="/login"
                                className="text-purple-600 hover:text-purple-700 font-semibold"
                            >
                                Fazer login
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-slate-500">
                        💰 Controle Financeiro Familiar
                    </p>
                </div>
            </div>
        </main>
    );
}

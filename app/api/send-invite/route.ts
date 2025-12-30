import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Inicializa o Resend com a chave de API
// A chave deve estar definida em .env.local como RESEND_API_KEY
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
    try {
        const { inviteeName, inviteeEmail, code, inviterName, familyName, link } = await request.json();

        if (!inviteeEmail || !code) {
            return NextResponse.json(
                { error: 'Dados incompletos para envio.' },
                { status: 400 }
            );
        }

        // Template de Email Simples
        const htmlContent = `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #059669;">Você foi convidado para o Poupa+</h2>
        <p>Olá, <strong>${inviteeName}</strong>!</p>
        <p><strong>${inviterName}</strong> convidou você para fazer parte da família <strong>${familyName}</strong> no aplicativo de controle financeiro.</p>
        
        <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #64748b;">Seu código de acesso:</p>
          <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #0f172a;">${code}</p>
        </div>

        <p>Para aceitar, acesse o link abaixo ou insira o código manualmente no app:</p>
        
        <div style="text-align: center; margin: 25px 0;">
            <a href="${link}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Aceitar Convite</a>
        </div>
        
        <p style="font-size: 12px; color: #94a3b8; margin-top: 30px; text-align: center;">
          Se você não esperava por este convite, pode ignorar este email.
        </p>
      </div>
    `;

        const data = await resend.emails.send({
            from: 'Poupa+ <onboarding@resend.dev>', // Usando domínio de teste do Resend
            to: [inviteeEmail],
            subject: `Convite de ${inviterName} para o Poupa+`,
            html: htmlContent,
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error('Erro ao enviar email:', error);
        return NextResponse.json(
            { error: 'Falha ao enviar email' },
            { status: 500 }
        );
    }
}

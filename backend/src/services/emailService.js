import nodemailer from 'nodemailer';
import { getConfig } from './configuracaoService.js';
import { pool } from '../db/index.js';

let transporter = null;

async function getTransporter() {
  const config = await getConfig();
  if (!config.smtp_host || !config.smtp_user) {
    throw new Error('SMTP não configurado. Configure em Configurações do Sistema.');
  }
  transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port || 587,
    secure: config.smtp_secure || false,
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass,
    },
  });
  return transporter;
}

async function getAdminEmails() {
  const { rows } = await pool.query(`
    SELECT email FROM motoristas WHERE role = 'admin' AND email IS NOT NULL AND email != ''
  `);
  return rows.map(r => r.email);
}

export async function enviarSenhaPorEmail(email, nome, senha) {
  const config = await getConfig();
  if (!config.smtp_host || !config.smtp_user) {
    throw new Error('SMTP não configurado. Configure em Configurações do Sistema.');
  }

  const transport = await getTransporter();
  const from = config.smtp_from || config.smtp_user;

  await transport.sendMail({
    from,
    to: email,
    subject: 'SSW Transportes - Acesso ao Sistema',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f0c040; border-bottom: 2px solid #f0c040; padding-bottom: 10px;">
          SSW TRANSPORTES
        </h2>
        <p>Olá <strong>${nome}</strong>,</p>
        <p>Seu acesso ao sistema foi configurado. Utilize as credenciais abaixo para fazer login:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>E-mail:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Senha:</strong> ${senha}</p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="https://driverfds.intuitiva.log.br" style="display: inline-block; background: #f0c040; color: #0d0f14; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
            Acessar o Sistema
          </a>
        </div>
        <p style="color: #666; font-size: 12px;">
          Recomendamos alterar sua senha após o primeiro acesso.
        </p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
        <p style="color: #999; font-size: 11px;">
          Este é um e-mail automático. Não responda.
        </p>
      </div>
    `,
  });
}

export async function notificarAdiantamentoAutomatico(motorista, valorLiquido, idRomaneio) {
  const config = await getConfig();
  if (!config.smtp_host || !config.smtp_user) return;

  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) return;

  const transport = await getTransporter();
  const from = config.smtp_from || config.smtp_user;

  await transport.sendMail({
    from,
    to: adminEmails.join(','),
    subject: `SSW - Adiantamento Automático Aprovado - ${motorista.nome}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3de8a0; border-bottom: 2px solid #3de8a0; padding-bottom: 10px;">
          ADIANTAMENTO AUTOMÁTICO
        </h2>
        <p>Um adiantamento foi <strong>aprovado automaticamente</strong> e o PIX foi enviado.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Motorista:</strong> ${motorista.nome} (${motorista.cpf})</p>
          <p style="margin: 5px 0;"><strong>Romaneio:</strong> #${idRomaneio}</p>
          <p style="margin: 5px 0;"><strong>Valor (50%):</strong> R$ ${valorLiquido.toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> PIX Enviado Imediatamente</p>
        </div>
        <p style="color: #666; font-size: 12px;">
          Este motorista possui pré-aprovção para adiantamentos. O PIX foi enviado automaticamente.
        </p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
        <p style="color: #999; font-size: 11px;">
          Este é um e-mail automático. Não responda.
        </p>
      </div>
    `,
  });
}

export async function notificarSolicitacao(motoristaEmail, motoristaNome, status, valor, idRomaneio) {
  const config = await getConfig();
  if (!config.smtp_host || !config.smtp_user || !motoristaEmail) return;

  const transport = await getTransporter();
  const from = config.smtp_from || config.smtp_user;

  const isAprovado = status === 'aprovado';
  const cor = isAprovado ? '#3de8a0' : '#ff5a5a';
  const textoStatus = isAprovado ? 'APROVADO' : 'RECUSADO';

  await transport.sendMail({
    from,
    to: motoristaEmail,
    subject: `SSW - Solicitação ${textoStatus} - Romaneio #${idRomaneio}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${cor}; border-bottom: 2px solid ${cor}; padding-bottom: 10px;">
          SOLICITAÇÃO ${textoStatus}
        </h2>
        <p>Olá <strong>${motoristaNome}</strong>,</p>
        <p>Sua solicitação de adiantamento foi <strong>${textoStatus.toLowerCase()}</strong>.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Romaneio:</strong> #${idRomaneio}</p>
          <p style="margin: 5px 0;"><strong>Valor:</strong> R$ ${Number(valor).toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${cor}; font-weight: bold;">${textoStatus}</span></p>
        </div>
        ${isAprovado ? '<p>O valor será transferido via PIX conforme o prazo configurado.</p>' : '<p>Entre em contato com o administrador para mais informações.</p>'}
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
        <p style="color: #999; font-size: 11px;">
          Este é um e-mail automático. Não responda.
        </p>
      </div>
    `,
  });
}

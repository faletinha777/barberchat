/* * BARBERCHAT SERVER - Versão Final Completa
 * Inclui: Fila, WPP Seguro, Mercado Pago e Função "Não Veio"
 */

const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- CONFIGURAÇÃO MERCADO PAGO ---
// ⚠️ Troque pelo seu Access Token de TESTE
const client = new MercadoPagoConfig({ accessToken: 'TEST-SEU-TOKEN-AQUI' });

// --- BANCO DE DADOS (Memória) ---
let fila = []; 
let clientWpp = null;

// --- FUNÇÕES AUXILIARES ---

function formatarNumeroParaWpp(telefone) {
    let limpo = telefone.replace(/\D/g, '');
    if (!limpo.startsWith('55')) {
        limpo = '55' + limpo;
    }
    return limpo;
}

async function enviarMensagemSegura(numero, mensagem) {
    if (!clientWpp) return;

    try {
        const numeroLimpo = formatarNumeroParaWpp(numero);
        const wid = `${numeroLimpo}@c.us`;

        // Verifica se o número existe no WhatsApp para evitar erros
        const result = await clientWpp.checkNumberStatus(wid);

        if (result.numberExists) {
            await clientWpp.sendText(result.id._serialized, mensagem);
            console.log(`📨 Zap enviado para: ${numeroLimpo}`);
        } else {
            console.log(`⚠️ O número ${numeroLimpo} não tem WhatsApp.`);
        }
    } catch (erro) {
        console.error(`❌ Erro Zap:`, erro.message);
    }
}

// --- WPPCONNECT START ---
wppconnect
  .create({
    session: 'barbearia-session',
    headless: true,
    logQR: true,
    browserArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  .then((client) => {
    clientWpp = client;
    console.log('✅ ROBÔ DO WHATSAPP INICIADO!');
  })
  .catch((error) => console.log('Erro WPP:', error));

// --- ROTAS DA API ---

// 1. Ver a Fila
app.get('/api/fila', (req, res) => {
    res.json(fila);
});

// 2. Cliente Entra na Fila
app.post('/api/entrar', async (req, res) => {
    const { name, phone } = req.body;
    
    const novoCliente = {
        id: Date.now().toString(),
        name,
        phone, 
        joinedAt: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
        status: 'waiting'
    };

    fila.push(novoCliente);
    console.log(`[NOVO] ${name} entrou na fila.`);
    
    const msg = `Olá ${name}! Você entrou na fila da Barbearia Stilo VIP. Sua posição é #${fila.length}.`;
    await enviarMensagemSegura(phone, msg);

    res.json(novoCliente);
});

// 3. Atualizar Status (Chamar ou Iniciar)
app.post('/api/atualizar', async (req, res) => {
    const { id, status } = req.body;
    
    const index = fila.findIndex(c => c.id === id);
    if (index !== -1) {
        fila[index].status = status;
        const cliente = fila[index];
        
        // Se for CHAMAR, avisa no Zap
        if (status === 'called') {
            const msg = `🔔 *ATENÇÃO ${cliente.name}*! \nÉ a sua vez! Por favor, dirija-se à cadeira.`;
            await enviarMensagemSegura(cliente.phone, msg);
        }

        res.json({ success: true, cliente });
    } else {
        res.status(404).json({ success: false });
    }
});

// 4. Função PULAR (Cliente não apareceu -> Vai pro final)
app.post('/api/pular', async (req, res) => {
    const { id } = req.body;
    const index = fila.findIndex(c => c.id === id);

    if (index !== -1) {
        // Remove da posição atual
        const [cliente] = fila.splice(index, 1);
        
        // Reseta status e joga pro final
        cliente.status = 'waiting';
        fila.push(cliente);
        
        console.log(`[PULAR] ${cliente.name} movido para o final.`);

        const msg = `⚠️ ${cliente.name}, chamamos sua vez e você não apareceu. Você foi movido para o final da fila.`;
        await enviarMensagemSegura(cliente.phone, msg);

        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

// 5. Finalizar Atendimento (Com Pagamento Opcional)
app.post('/api/finalizar', async (req, res) => {
    const { id, valor } = req.body;
    
    const clienteRemovido = fila.find(c => c.id === id);
    
    if (clienteRemovido) {
        // Remove definitivamente da fila
        fila = fila.filter(c => c.id !== id);
        
        let msgPagamento = "";
        let textoValor = "";

        // Só gera link se tiver valor
        if (valor && parseFloat(valor) > 0) {
            textoValor = ` O valor total foi R$ ${valor}.`;
            try {
                const preference = new Preference(client);
                const result = await preference.create({
                    body: {
                        items: [
                            {
                                title: 'Serviço Barbearia Stilo VIP',
                                quantity: 1,
                                unit_price: Number(valor)
                            }
                        ],
                        // Exibe Pix e Cartão
                        payment_methods: {
                            excluded_payment_types: [],
                            installments: 1
                        },
                        back_urls: {
                            success: "https://chatbarber-8q6pjcre1-faletarenan2-3287s-projects.vercel.app", 
                            failure: "https://chatbarber-8q6pjcre1-faletarenan2-3287s-projects.vercel.app",
                            pending: "https://chatbarber-8q6pjcre1-faletarenan2-3287s-projects.vercel.app"
                        },
                        auto_return: "approved",
                    }
                });
                
                msgPagamento = `\n\n💳 *Link para Pagamento (Pix ou Cartão):*\n${result.init_point}`;
                console.log(`Link gerado para ${clienteRemovido.name}`);

            } catch (error) {
                console.error("Erro MP:", error);
                msgPagamento = "\n(Houve um erro ao gerar o link. Pague no balcão).";
            }
        }

        const msgFinal = `✂️ Atendimento finalizado!${textoValor}${msgPagamento}\n\nObrigado pela preferência, ${clienteRemovido.name}!`;
        await enviarMensagemSegura(clienteRemovido.phone, msgFinal);
    }

    res.json({ success: true });
});

// --- LIGAR SERVIDOR ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 SERVIDOR ON NA PORTA ${PORT}`);
});
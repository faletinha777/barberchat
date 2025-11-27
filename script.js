
const BARBERSHOP_PHONE = "5531973216604"; 

const DB_SERVICES = [
    { name: 'Corte Degradê', price: 'R$ 35,00', icon: 'fa-user' },
    { name: 'Barba Modelada', price: 'R$ 25,00', icon: 'fa-face-smile' },
    { name: 'Combo Completo', price: 'R$ 55,00', icon: 'fa-crown' },
    { name: 'Sobrancelha', price: 'R$ 15,00', icon: 'fa-wand-magic-sparkles' }
];

let currentState = {
    step: 0,
    stepName: 'welcome',
    data: { name: '', service: '', date: '', time: '', phone: '' }
};

const STEPS_MAP = ['welcome', 'get_service', 'get_date', 'get_time', 'get_phone', 'confirmation', 'finished'];


const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-button');
const chatMessages = document.getElementById('chat-messages');
const inputArea = document.getElementById('chat-input-area');
const progressBar = document.getElementById('progress-bar');
const themeBtn = document.getElementById('theme-toggle');


window.onload = async () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') applyTheme('light');
    
    updateProgressBar();
    
    const greeting = getTimeGreeting();
    await fakeApiDelay(600); 
    addMessage("bot", `Olá, ${greeting}! Bem-vindo à **Barbearia Stilo VIP**.`);

    const savedName = localStorage.getItem('clientName');
    if (savedName) {
        currentState.data.name = savedName;
        await fakeApiDelay(800);
        addMessage("bot", `Que bom te ver de volta, **${savedName}**!`);
        
        setTimeout(() => {
             addMessage('bot', "Deseja fazer um novo agendamento?", [
                { text: 'Novo Agendamento', value: 'services', icon: 'fa-calendar-plus' }
             ]);
        }, 600);
        currentState.stepName = 'returning_user';
    } else {
        await fakeApiDelay(1000);
        addMessage("bot", "Para começar, qual é o seu **nome**?");
    }
};


window.toggleTheme = function() {
    const isLight = document.body.classList.contains('light-theme');
    const newTheme = isLight ? 'dark' : 'light';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
};

function applyTheme(theme) {
    const icon = themeBtn.querySelector('i');
    if (theme === 'light') {
        document.body.classList.add('light-theme');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        document.body.classList.remove('light-theme');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}


chatInput.addEventListener('input', (e) => {
    if (currentState.stepName === 'get_phone') maskPhone(e.target);
    sendBtn.disabled = e.target.value.trim() === '';
    chatInput.classList.remove('input-error');
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendBtn.disabled) handleUserInput();
});


async function handleUserInput() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    addMessage('user', text);
    chatInput.value = '';
    sendBtn.disabled = true;
    
    await processStep(text);
}

async function processStep(text) {
    showTyping();
    inputArea.style.display = 'none';

    await fakeApiDelay(Math.floor(Math.random() * 800) + 600);

    removeTyping();

    switch (currentState.stepName) {
        case 'welcome':
            currentState.data.name = text;
            localStorage.setItem('clientName', text);
            addMessage('bot', `Prazer, **${text}**!`);
            advanceStep('get_service');
            askService();
            break;

        case 'returning_user':
            advanceStep('get_service');
            askService();
            break;

        case 'get_service':
            currentState.data.service = text;
            addMessage('bot', `Perfeito! Consultando agenda...`);
            await fakeApiDelay(1200); 
            addMessage('bot', `Escolha o melhor dia:`, generateDateOptions());
            advanceStep('get_date');
            break;

        case 'get_date':
            currentState.data.date = text;
            const validTimes = filterTimesByTime(text);
            if (validTimes.length === 0) {
                addMessage('bot', `Para **${text}** não temos mais horários. Tente outro dia:`, generateDateOptions());
            } else {
                addMessage('bot', `Dia **${text}**. Qual horário?`, generateTimeOptions(validTimes));
                advanceStep('get_time');
            }
            break;

        case 'get_time':
            currentState.data.time = text;
            addMessage('bot', "Ok! Digite seu WhatsApp para contato (DDD + Número).");
            setInputType('tel');
            advanceStep('get_phone');
            break;

        case 'get_phone':
            if (text.length < 14) {
                addMessage('bot', "Número inválido. Ex: (11) 99999-9999");
                setInputType('tel');
                chatInput.classList.add('input-error');
                inputArea.style.display = 'flex';
            } else {
                currentState.data.phone = text;
                confirmAppointment();
            }
            break;
    }
}


function fakeApiDelay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function advanceStep(nextStepName) {
    currentState.stepName = nextStepName;
    currentState.step = STEPS_MAP.indexOf(nextStepName);
    updateProgressBar();
}

function updateProgressBar() {
    const percent = ((currentState.step) / (STEPS_MAP.length - 1)) * 100;
    progressBar.style.width = `${percent}%`;
}

function askService() {
    addMessage('bot', "Qual serviço vamos realizar?", 
        DB_SERVICES.map(s => ({ text: `${s.name} <small>(${s.price})</small>`, value: s.name, icon: s.icon }))
    );
}

function filterTimesByTime(dateString) {
    const allTimes = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
    if (!dateString.includes("Hoje")) return allTimes;
    const currentHour = new Date().getHours();
    return allTimes.filter(t => parseInt(t) > currentHour);
}

function confirmAppointment() {
    advanceStep('confirmation');
    addMessage('bot', "Confira se está tudo certo:", [
        { text: '✅ Confirmar', value: 'confirm' },
        { text: '❌ Cancelar', value: 'cancel' }
    ]);
    createTicket(currentState.data, false); 
}

function createTicket(data, final = false) {
    const ticket = document.createElement('div');
    ticket.className = 'ticket-container';
    ticket.innerHTML = `
        <div class="ticket-cutout cutout-left"></div>
        <div class="ticket-cutout cutout-right"></div>
        <div class="ticket-header">
            <h3>${final ? 'AGENDAMENTO CONFIRMADO' : 'REVISÃO DE DADOS'}</h3>
            <small>Barbearia Stilo VIP</small>
        </div>
        <div class="ticket-body">
            <div class="ticket-row"><span class="ticket-label">Cliente:</span> <span class="ticket-value">${data.name}</span></div>
            <div class="ticket-row"><span class="ticket-label">Serviço:</span> <span class="ticket-value">${data.service}</span></div>
            <div class="ticket-row"><span class="ticket-label">Data:</span> <span class="ticket-value">${data.date}</span></div>
            <div class="ticket-row"><span class="ticket-label">Horário:</span> <span class="ticket-value">${data.time}</span></div>
        </div>
        <div class="ticket-footer">
            ${final ? '<i class="fa-solid fa-barcode"></i> 12345-STILO-VIP' : 'Confirme para gerar seu passe.'}
        </div>
    `;
    chatMessages.appendChild(ticket);
    scrollToBottom();
}


function showRatingSystem() {
    const div = document.createElement('div');
    div.className = 'rating-container';
    div.innerHTML = `
        <div class="rating-title">Avalie nossa experiência:</div>
        <div class="stars-box">
            <i class="fa-solid fa-star star" data-value="1"></i>
            <i class="fa-solid fa-star star" data-value="2"></i>
            <i class="fa-solid fa-star star" data-value="3"></i>
            <i class="fa-solid fa-star star" data-value="4"></i>
            <i class="fa-solid fa-star star" data-value="5"></i>
        </div>
    `;
    chatMessages.appendChild(div);
    scrollToBottom();

   
    const stars = div.querySelectorAll('.star');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            
            const value = star.getAttribute('data-value');
            stars.forEach(s => {
                s.classList.remove('active');
                if(s.getAttribute('data-value') <= value) s.classList.add('active');
            });
            
            
            setTimeout(() => {
                div.innerHTML = `<div class="rating-thanks"><i class="fa-solid fa-heart"></i> Obrigado pela avaliação!</div>`;
                
                showWhatsAppButton();
            }, 500);
        });
    });
}

function showWhatsAppButton() {
    const msg = `Olá! Gostaria de agendar:\n*Cliente:* ${currentState.data.name}\n*Serviço:* ${currentState.data.service}\n*Data:* ${currentState.data.date}\n*Horário:* ${currentState.data.time}`;
    const link = `https://wa.me/${BARBERSHOP_PHONE}?text=${encodeURIComponent(msg)}`;
    
    const btn = document.createElement('button');
    btn.className = 'option-button';
    btn.style.background = '#25D366';
    btn.style.color = '#fff';
    btn.style.marginTop = '15px';
    btn.style.width = '100%';
    btn.style.justifyContent = 'center';
    btn.innerHTML = '<span>Finalizar no WhatsApp</span> <i class="fa-brands fa-whatsapp"></i>';
    btn.onclick = () => window.open(link, '_blank');
    chatMessages.appendChild(btn);
    scrollToBottom();
}

// Processo Final Atualizado
const _originalProcess = processStep;
processStep = async function(text) {
    if (currentState.stepName === 'confirmation') {
        showTyping();
        await fakeApiDelay(1000);
        removeTyping();

        if (text === 'confirm') {
            saveToHistory();
            document.querySelectorAll('.option-button').forEach(b => b.remove());
            
            createTicket(currentState.data, true);
            advanceStep('finished');
            
            addMessage('bot', "Agendamento realizado com sucesso! 🎉");
            
            await fakeApiDelay(800);
            showRatingSystem(); // Chama a avaliação
            
        } else {
            addMessage('bot', "Agendamento cancelado. Reinicie para tentar de novo.");
        }
    } else {
        await _originalProcess(text);
    }
}

// Helpers UI & Utils
function addMessage(sender, text, options = null) {
    const div = document.createElement('div');
    div.className = `message ${sender === 'bot' ? 'attendant-message' : 'client-message'}`;
    div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    chatMessages.appendChild(div);

    if (options) {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'options-grid';
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'option-button';
            btn.innerHTML = `<span>${opt.text}</span> <i class="fa-solid ${opt.icon || 'fa-chevron-right'}"></i>`;
            btn.onclick = () => handleOptionClick(opt.value, opt.text);
            optionsDiv.appendChild(btn);
        });
        chatMessages.appendChild(optionsDiv);
    }
    scrollToBottom();
    if (sender === 'bot' && !options && currentState.stepName !== 'confirmation' && currentState.stepName !== 'finished') {
         inputArea.style.display = 'flex';
         setTimeout(() => chatInput.focus(), 100);
    }
}

function handleOptionClick(value, text) {
    document.querySelectorAll('.option-button').forEach(b => b.remove());
    addMessage('user', text);
    processStep(value);
}

function getTimeGreeting() {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function generateDateOptions() {
    const options = [];
    const today = new Date();
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    for (let i = 0; i < 6; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (d.getDay() === 0) continue;
        let label = `${weekDays[d.getDay()]}, ${d.getDate()}/${d.getMonth()+1}`;
        if (i === 0) label = "Hoje";
        if (i === 1) label = "Amanhã";
        options.push({ text: label, value: i === 0 ? `Hoje (${d.toLocaleDateString('pt-BR')})` : d.toLocaleDateString('pt-BR'), icon: 'fa-calendar-day' });
    }
    return options;
}

function generateTimeOptions(validTimes) {
    return validTimes.map(t => ({ text: t, value: t, icon: 'fa-clock' }));
}

function maskPhone(input) {
    let v = input.value.replace(/\D/g, '');
    v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
    v = v.replace(/(\d)(\d{4})$/, '$1-$2');
    input.value = v.slice(0, 15);
}

function setInputType(type) {
    chatInput.type = type;
    if(type === 'tel') chatInput.placeholder = "(XX) XXXXX-XXXX";
}

function showTyping() {
    const div = document.createElement('div');
    div.className = 'typing-indicator';
    div.id = 'typing';
    div.innerHTML = '<span></span><span></span><span></span>'.replace(/span/g, 'div class="typing-dot"');
    chatMessages.appendChild(div);
    scrollToBottom();
}

function removeTyping() {
    const t = document.getElementById('typing');
    if (t) t.remove();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function saveToHistory() {
    const h = JSON.parse(localStorage.getItem('barberHistory')) || [];
    currentState.data.timestamp = new Date().toLocaleString();
    h.push(currentState.data);
    localStorage.setItem('barberHistory', JSON.stringify(h));
}

window.resetChat = function() {
    if(confirm("Reiniciar conversa?")) {
        localStorage.removeItem('clientName');
        location.reload();
    }
};

window.showHistory = function() {
    const h = JSON.parse(localStorage.getItem('barberHistory'));
    alert(h && h.length ? `Último: ${h[h.length-1].date} - ${h[h.length-1].service}` : "Nenhum histórico.");
};
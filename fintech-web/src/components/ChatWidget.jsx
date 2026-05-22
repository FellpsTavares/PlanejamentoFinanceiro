import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { transportService } from '../services/transport';
import { toast } from '../utils/toast';

// Constantes
const VIAGEM_TRIGGERS = ['adicionar viagem', 'nova viagem', 'criar viagem', 'registrar viagem'];

const MESES_EXTENSO = {
  'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
  'abril': '04', 'maio': '05', 'junho': '06',
  'julho': '07', 'agosto': '08', 'setembro': '09',
  'outubro': '10', 'novembro': '11', 'dezembro': '12'
};

const NUMEROS_EXTENSO = {
  'um': '1', 'dois': '2', 'três': '3', 'tres': '3', 'quatro': '4', 'cinco': '5',
  'seis': '6', 'sete': '7', 'oito': '8', 'nove': '9', 'dez': '10',
  'onze': '11', 'doze': '12', 'treze': '13', 'quatorze': '14', 'quinze': '15',
  'dezesseis': '16', 'dezessete': '17', 'dezoito': '18', 'dezenove': '19', 'vinte': '20',
  'vinte e um': '21', 'vinte e dois': '22', 'vinte e três': '23', 'vinte e tres': '23',
  'vinte e quatro': '24', 'vinte e cinco': '25', 'vinte e seis': '26', 'vinte e sete': '27',
  'vinte e oito': '28', 'vinte e nove': '29', 'trinta': '30', 'trinta e um': '31'
};

const FIELD_TRANSLATIONS = {
  'vehicle': 'Veículo', 'date': 'Data', 'start_date': 'Data de Início',
  'end_date': 'Data de Término', 'modality': 'Modalidade',
  'description': 'Descrição', 'base_expense_value': 'Valor de Outros Gastos',
  'fuel_expense_value': 'Valor de Combustível', 'initial_km': 'KM Inicial',
  'final_km': 'KM Final', 'tons': 'Toneladas', 'rate_per_ton': 'Valor por Tonelada',
  'days': 'Dias', 'daily_rate': 'Valor Diário'
};

const WELCOME_MESSAGE = `Olá! 👋 Crie viagens rapidamente com linguagem natural!

**Exemplos:**
• "adicionar viagem veiculo ABC1234 - 25 toneladas a 150 reais no dia 20/05/2026"
• "nova viagem veiculo DEF5678 por 3 dias a 500 reais por dia"
• "Viagem do veiculo AAA1236 no dia 9 de março, fazenda planeste, 48,5 x 115 ton
Gastos gerais 150,00 - borracharia
Gastos com combustiveis 2000,15"

✨ **Dica:** Data não informada = usa hoje automaticamente!`;

// Utilitários
const translateFieldName = (field) => FIELD_TRANSLATIONS[field] || field;

const parseMoney = (val) => {
  if (!val) return 0;
  const str = String(val).trim();
  
  // Formato brasileiro: vírgula = decimal, ponto = milhar
  // Ex: 49.610 = 49610 | 49.610,50 = 49610.50 | 49,61 = 49.61
  if (str.includes(',')) {
    // Tem vírgula: remover pontos (milhar) e trocar vírgula por ponto (decimal)
    return Number(str.replace(/\./g, '').replace(',', '.')) || 0;
  }
  
  // Sem vírgula: múltiplos pontos = milhar, um ponto = pode ser decimal ou milhar
  const dotCount = (str.match(/\./g) || []).length;
  if (dotCount > 1) {
    // Múltiplos pontos = separadores de milhar (49.610.000)
    return Number(str.replace(/\./g, '')) || 0;
  }
  
  // Um ponto: verificar posição
  if (dotCount === 1) {
    const parts = str.split('.');
    // Se últimos dígitos tem exatamente 3 caracteres = milhar (49.610, 149.610)
    // Se tem menos de 3 = decimal (49.5, 123.45)
    if (parts[1] && parts[1].length === 3) {
      // Separador de milhares
      return Number(str.replace(/\./g, '')) || 0;
    }
  }
  
  return Number(str) || 0;
};

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return dateStr;
};

const getCurrentDate = () => {
  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();
  return `${dia}/${mes}/${ano}`;
};

const cleanDescription = (desc) => {
  return desc
    .replace(/(?:no\s+dia|data|em)[:\s]+\d{1,2}\/\d{1,2}(?:\/\d{4})?[,\s]*/gi, '')
    .replace(/(?:no\s+dia|data|em)[:\s]+(?:\d+|um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte(?:\s+e\s+(?:um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove))?|trinta(?:\s+e\s+um)?)\s+de\s+(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[,\s]*/gi, '')
    .replace(/^\s*(?:\d+|um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte(?:\s+e\s+(?:um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove))?|trinta(?:\s+e\s+um)?)\s+de\s+(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[,\s]*/gi, '')
    .replace(/\s*(gastos|combustivel).*$/i, '')
    .replace(/^[,\s-]+|[,\s-]+$/g, '')
    .trim();
};

// Parser de viagem
const parseViagemMessage = (text) => {
  const normalized = text.trim().toLowerCase();
  
  const isViagemCommand = VIAGEM_TRIGGERS.some(trigger => normalized.includes(trigger));
  if (!isViagemCommand) {
    return { error: 'Comando não reconhecido. Use: "adicionar viagem", "nova viagem" ou "criar viagem".' };
  }

  const data = {};
  
  // Veículo
  let match = normalized.match(/v[eaá]icu?lo[:\s-]+([a-z0-9]+)/i) || 
              normalized.match(/viagem\s+do\s+v[eaá]icu?lo\s+([a-z0-9]+)/i) ||
              normalized.match(/veiculo[,\s]+([a-z0-9]+)/i);
  if (match) data.veiculo = match[1].toUpperCase();

  // Toneladas x Valor - Aceita formato brasileiro: 49.610 = 49,610 toneladas
  match = text.match(/([\d,.]+)\s*[x×]\s*([\d,.]+)\s*(?:ton|toneladas?)?/i);
  if (match) {
    const str1 = match[1];
    const str2 = match[2];
    
    // Converter para formato numérico comparável
    const num1 = str1.replace(/\./g, '').replace(',', '.');
    const num2 = str2.replace(/\./g, '').replace(',', '.');
    const val1 = parseFloat(num1);
    const val2 = parseFloat(num2);
    
    // Identificar qual é tonelada (geralmente o maior número) e qual é valor/ton
    // Valores típicos: toneladas = milhares (49.610), valor = centenas (123)
    if (val1 > val2) {
      // str1 é toneladas (formato: 49.610), str2 é valor (formato: 123)
      data.tons = str1.replace('.', ','); // Converter para formato com vírgula: 49,610
      data.valor_ton = str2;
    } else {
      // str2 é toneladas, str1 é valor
      data.tons = str2.replace('.', ',');
      data.valor_ton = str1;
    }
  }

  // Dias
  if (!data.tons) {
    match = normalized.match(/(?:por\s+)?(\d+)\s*dias?/i);
    if (match) data.dias = match[1];
  }

  // Valor diário
  match = normalized.match(/(?:di[aá]ria\s+de|por\s+dia|valor\s+di[aá]rio)[:\s]+r?\$?\s*(\d+(?:[.,]\d+)?)/i);
  if (match) data.valor_diario = match[1].replace(',', '.');

  // Data - Formato 1: dd/mm/yyyy
  match = normalized.match(/(?:no\s+dia|data|dia|em)[:\s,]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (match) {
    data.data = match[1];
  }
  // Data - Formato 2: dd/mm (sem ano)
  else {
    match = normalized.match(/(?:no\s+dia|data|dia|em)[:\s,]*(\d{1,2}\/\d{1,2})(?![/\d])/i);
    if (match) data.data = `${match[1]}/${new Date().getFullYear()}`;
  }
  // Data - Formato 3: por extenso
  if (!data.data) {
    match = normalized.match(/(\d{1,2}|um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte(?:\s+e\s+(?:um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove))?|trinta(?:\s+e\s+um)?)\s+de\s+(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i);
    if (match) {
      let dia = match[1];
      if (isNaN(dia)) dia = NUMEROS_EXTENSO[dia.toLowerCase()] || dia;
      const mes = MESES_EXTENSO[match[2].toLowerCase()];
      data.data = `${String(dia).padStart(2, '0')}/${mes}/${new Date().getFullYear()}`;
    }
  }
  if (!data.data) data.data = getCurrentDate();

  // Modalidade
  if (normalized.includes('arrendamento') || normalized.includes('diaria') || normalized.includes('diária')) {
    data.modalidade = 'diaria';
  } else if (data.tons || normalized.includes('tonelada')) {
    data.modalidade = 'tonelada';
  }

  // Descrição - Formato explícito
  match = normalized.match(/(?:descri[cç][aã]o|obs|observa[cç][aã]o)[:\s]+(.+?)(?:\s+(?:veiculo|data|no dia|combustivel)|$)/i);
  if (!match && data.veiculo && data.data) {
    // Formato implícito: extrair texto entre a data completa e as toneladas
    // Buscar a parte da mensagem que vem depois da data
    const dataMatch = text.match(/\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{1,2}/);
    if (dataMatch) {
      const dataPos = text.indexOf(dataMatch[0]);
      const afterDateFull = text.substring(dataPos + dataMatch[0].length);
      // Extrair texto até encontrar o padrão de toneladas (número x número)
      const descMatch = afterDateFull.match(/[,\s]+(.+?)(?=\s*[\d,.]+\s*[x×]|\s*outros\s+gastos|$)/i);
      if (descMatch && descMatch[1].trim().length > 0) {
        let desc = descMatch[1].trim();
        // Remover referências a veículo no início
        desc = desc.replace(/^[,\s]*(?:veiculo|veículo)[\s:]+[a-z0-9]+[,\s]*/i, '');
        desc = desc.replace(/^[,\s]+/, '').replace(/[,\s]+$/, '');
        if (desc.length > 2) data.descricao = desc;
      }
    }
  }
  if (match && !data.descricao) data.descricao = match[1].trim();

  // Combustível
  match = normalized.match(/combust[ií]vel[:\s]+r?\$?\s*(\d+(?:[.,]\d+)?)/i) ||
          normalized.match(/gastos\s+com\s+combust[ií]ve(?:l|is)[\s\n]*r?\$?\s*(\d+(?:[.,]\d+)?)/i);
  if (match) data.combustivel = match[1].replace(',', '.');

  // Outros gastos - Múltiplos valores separados: "28 - Balsa, 149 - concerto"
  match = text.match(/outros\s+gastos[\s\n]*[-:]?\s*(.+?)(?=\s*(?:gastos\s+com\s+combust|combustivel|km\s+inicial|km\s+final|$))/i);
  if (match) {
    const gastosText = match[1];
    // Extrair todos os valores numéricos e suas descrições
    const gastosMatches = [...gastosText.matchAll(/([\d,.]+)(?:\s*-\s*([^,\d]+))?/g)];
    
    data.gastos_individuais = [];
    
    for (const gMatch of gastosMatches) {
      // Usar parseMoney para processar valor no formato brasileiro
      const valorStr = gMatch[1];
      const valorNum = parseMoney(valorStr);
      
      if (!isNaN(valorNum) && valorNum > 0) {
        data.gastos_individuais.push({
          valor: valorNum,
          descricao: gMatch[2] ? gMatch[2].trim().replace(/[.,;!?]+$/, '') : 'Outros gastos'
        });
      }
    }
  }

  // KM
  match = normalized.match(/km\s+inicial[:\s]+(\d+)/i);
  if (match) data.km_inicial = match[1];
  match = normalized.match(/km\s+final[:\s]+(\d+)/i);
  if (match) data.km_final = match[1];

  return { data };
};

// Normalização de dados
const normalizeViagemData = async (parsed) => {
  const { data } = parsed;
  
  if (!data.veiculo) {
    return { error: 'Campo "Veículo" é obrigatório. Exemplo: "veiculo ABC1234"' };
  }

  let vehicle;
  try {
    const vehicles = await transportService.getVehicles({ no_page: '1' });
    const allVehicles = vehicles.results || vehicles || [];
    vehicle = allVehicles.find(v => v.plate.toUpperCase() === data.veiculo.toUpperCase());
    if (!vehicle) {
      return { error: `Veículo "${data.veiculo}" não encontrado. Verifique a placa.` };
    }
  } catch (err) {
    return { error: 'Erro ao buscar veículo: ' + (err.message || 'erro desconhecido') };
  }

  const modality = data.modalidade?.includes('diaria') ? 'lease' : 'per_ton';
  const startDate = parseDate(data.data) || new Date().toISOString().slice(0, 10);

  const payload = {
    vehicle: vehicle.id,
    date: startDate,
    start_date: startDate,
    end_date: null,
    modality,
    progress_type: '',
    description: data.descricao || '',
    is_received: false,
    fuel_expense_value: parseMoney(data.combustivel || 0),
    initial_km: data.km_inicial ? Number(data.km_inicial) : null,
    final_km: data.km_final ? Number(data.km_final) : null,
    driver_receive_type: '1',
    driver_payment: 0
  };

  // Processar gastos individuais ou gasto único (compatibilidade)
  if (data.gastos_individuais && data.gastos_individuais.length > 0) {
    payload.expense_items = data.gastos_individuais;
    payload.base_expense_value = 0; // Não usar base_expense_value quando há items
  } else {
    payload.base_expense_value = 0;
    payload.expense_items = [];
  }

  if (modality === 'per_ton') {
    const tons = parseMoney(data.tons || 0);
    const ratePerTon = parseMoney(data.valor_ton || 0);
    if (tons === 0 || ratePerTon === 0) {
      return { error: 'Informe toneladas e valor. Ex: "49.61 x 123"' };
    }
    payload.tons = tons;
    payload.rate_per_ton = ratePerTon;
    payload.days = null;
    payload.daily_rate = null;
  } else {
    const days = Number(data.dias || 0);
    const dailyRate = parseMoney(data.valor_diario || 0);
    if (days === 0 || dailyRate === 0) {
      return { error: 'Informe dias e valor diário. Ex: "3 dias a 500 reais"' };
    }
    payload.days = days;
    payload.daily_rate = dailyRate;
    payload.tons = null;
    payload.rate_per_ton = null;
  }

  return { payload };
};

// Componente principal
export default function ChatWidget({ open, onClose }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([{ role: 'assistant', text: WELCOME_MESSAGE }]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [pendingTrip, setPendingTrip] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || processing) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setProcessing(true);

    try {
      let parsed = pendingTrip
        ? { data: { ...pendingTrip, ...parseViagemMessage('adicionar viagem ' + userMessage).data } }
        : parseViagemMessage(userMessage);

      if (parsed.error && !pendingTrip) {
        setMessages(prev => [...prev, { role: 'assistant', text: `❌ ${parsed.error}` }]);
        return;
      }

      const normalized = await normalizeViagemData(parsed);
      if (normalized.error) {
        setPendingTrip(parsed.data);
        
        let helpMsg = `❌ ${normalized.error}\n\n📝 **Já capturado:**\n`;
        if (parsed.data.veiculo) helpMsg += `✓ Veículo: ${parsed.data.veiculo}\n`;
        if (parsed.data.tons) helpMsg += `✓ Toneladas: ${parsed.data.tons}\n`;
        if (parsed.data.valor_ton) helpMsg += `✓ Valor/ton: R$ ${parsed.data.valor_ton}\n`;
        if (parsed.data.data) helpMsg += `✓ Data: ${parsed.data.data}\n`;
        if (parsed.data.descricao) helpMsg += `✓ Descrição: ${parsed.data.descricao}\n`;
        helpMsg += '\n💡 Envie as informações faltantes.';
        
        setMessages(prev => [...prev, { role: 'assistant', text: helpMsg }]);
        return;
      }

      const created = await transportService.createTrip(normalized.payload);
      setPendingTrip(null);
      
      // Buscar dados do veículo para mostrar a placa
      let vehiclePlate = created.vehicle;
      try {
        const vehicles = await transportService.getVehicles({ no_page: '1' });
        const allVehicles = vehicles.results || vehicles || [];
        const vehicleData = allVehicles.find(v => v.id === created.vehicle);
        if (vehicleData) {
          vehiclePlate = vehicleData.plate + (vehicleData.model ? ` — ${vehicleData.model}` : '');
        }
      } catch (err) {
        console.error('Erro ao buscar placa do veículo:', err);
      }
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        type: 'tripCreated',
        tripData: {
          id: created.id,
          vehicle: vehiclePlate,
          description: created.description || 'Sem descrição',
          totalValue: Number(created.total_value || 0).toFixed(2),
          date: created.start_date || created.date
        }
      }]);
      toast('Viagem criada!', 'success');
    } catch (err) {
      let errMsg = '❌ **Erro ao criar viagem.**\n\n';
      
      if (err.response?.data) {
        const errorData = err.response.data;
        if (typeof errorData === 'object') {
          Object.keys(errorData).forEach(field => {
            const errors = Array.isArray(errorData[field]) ? errorData[field].join(', ') : errorData[field];
            errMsg += `• **${translateFieldName(field)}**: ${errors}\n`;
          });
        } else {
          errMsg += JSON.stringify(errorData);
        }
      } else {
        errMsg += `${err.message || 'Erro desconhecido'}\n`;
      }
      
      setMessages(prev => [...prev, { role: 'assistant', text: errMsg }]);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelTrip = async (tripId) => {
    try {
      await transportService.deleteTrip(tripId);
      toast('Viagem cancelada', 'success');
      setMessages(prev => [...prev, { role: 'assistant', text: '✅ Viagem cancelada.' }]);
    } catch {
      toast('Erro ao cancelar', 'error');
      setMessages(prev => [...prev, { role: 'assistant', text: '❌ Erro ao cancelar viagem.' }]);
    }
  };

  const handleAccessTrip = (tripId) => {
    navigate(`/transport/trips?trip=${tripId}`);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="text-xl">💬</span>
          <h3 className="font-semibold">Chat Assistente</h3>
        </div>
        <button onClick={onClose} className="text-white hover:text-gray-200 text-xl">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg, idx) => {
          if (msg.type === 'tripCreated' && msg.tripData) {
            return (
              <div key={idx} className="flex justify-start">
                <div className="max-w-[85%] bg-green-50 border-2 border-green-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">✅</span>
                    <h4 className="font-bold text-green-800 text-lg">Viagem criada!</h4>
                  </div>
                  
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Descrição:</span>
                      <span className="font-semibold text-gray-900">{msg.tripData.description}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Veículo:</span>
                      <span className="font-semibold text-gray-900">{msg.tripData.vehicle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor:</span>
                      <span className="font-semibold text-green-700">R$ {msg.tripData.totalValue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Data:</span>
                      <span className="font-semibold text-gray-900">{msg.tripData.date}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccessTrip(msg.tripData.id)}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm"
                    >
                      📋 Acessar
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Confirma exclusão da viagem?')) {
                          handleCancelTrip(msg.tripData.id);
                        }
                      }}
                      className="flex-1 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 font-medium text-sm border border-red-300"
                    >
                      ❌ Cancelar
                    </button>
                  </div>
                </div>
              </div>
            );
          }
          
          return (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-2 rounded-lg whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-800 border border-gray-200'
              }`}>
                {msg.text}
              </div>
            </div>
          );
        })}
        {processing && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg">
              <span className="animate-pulse">Processando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-gray-200 bg-white rounded-b-xl">
        {pendingTrip && (
          <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-amber-600">⚠️</span>
              <span className="text-amber-800">Complementando...</span>
            </div>
            <button
              onClick={() => {
                setPendingTrip(null);
                setMessages(prev => [...prev, { role: 'assistant', text: '🔄 Reiniciado!' }]);
              }}
              className="text-amber-600 hover:text-amber-800 font-medium"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Digite sua mensagem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            disabled={processing}
          />
          <button
            onClick={handleSend}
            disabled={processing || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

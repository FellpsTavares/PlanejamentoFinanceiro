import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { transportService } from '../services/transport';
import { toast } from '../utils/toast';

/**
 * Traduz nomes de campos técnicos da API para português amigável.
 */
const translateFieldName = (fieldName) => {
  const translations = {
    'vehicle': 'Veículo',
    'date': 'Data',
    'start_date': 'Data de Início',
    'end_date': 'Data de Término',
    'modality': 'Modalidade',
    'progress_type': 'Tipo de Andamento',
    'description': 'Descrição',
    'is_received': 'Status de Recebimento',
    'base_expense_value': 'Valor de Outros Gastos',
    'fuel_expense_value': 'Valor de Combustível',
    'initial_km': 'KM Inicial',
    'final_km': 'KM Final',
    'tons': 'Toneladas',
    'rate_per_ton': 'Valor por Tonelada',
    'days': 'Dias',
    'daily_rate': 'Valor Diário',
    'driver_receive_type': 'Tipo de Pagamento do Motorista',
    'driver_payment': 'Pagamento do Motorista',
    'non_field_errors': 'Erro Geral',
    'detail': 'Detalhes',
    'error': 'Erro',
    'message': 'Mensagem'
  };
  return translations[fieldName] || fieldName;
};

/**
 * Parser flexível de mensagens para criar viagens.
 * Aceita formatos naturais em português.
 */
const parseViagemMessage = (text) => {
  const normalized = text.trim().toLowerCase();
  
  // Verificar comandos de criação de viagem (flexível)
  const viagemTriggers = ['adicionar viagem', 'nova viagem', 'criar viagem', 'registrar viagem', 'viagem add', 'add viagem'];
  const isViagemCommand = viagemTriggers.some(trigger => normalized.includes(trigger));
  
  if (!isViagemCommand) {
    return { error: 'Comando não reconhecido. Para criar uma viagem, comece com: "adicionar viagem", "nova viagem" ou "criar viagem", seguido dos dados da viagem.' };
  }

  const data = {};
  
  // === EXTRAIR VEÍCULO (aceita veiculo/vaiculo com ou sem acento) ===
  // Formato 1: "veiculo XXX1234" ou "veiculo: XXX1234"
  let veiculoMatch = normalized.match(/v[eaá]icu?lo[:\s-]+([a-z0-9]+)/i);
  // Formato 2: "Viagem do veiculo XXX1234"
  if (!veiculoMatch) {
    veiculoMatch = normalized.match(/viagem\s+do\s+v[eaá]icu?lo\s+([a-z0-9]+)/i);
  }
  if (veiculoMatch) {
    data.veiculo = veiculoMatch[1].toUpperCase();
  }

  // === EXTRAIR TONELADAS E VALOR (formato: "peso 48.14 x 177 ton" ou "48.14 x 177") ===
  const pesoXMatch = normalized.match(/(?:peso\s+)?(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*(?:ton|toneladas?)?/i);
  if (pesoXMatch) {
    data.tons = pesoXMatch[1].replace(',', '.');
    data.valor_ton = pesoXMatch[2].replace(',', '.');
  }
  
  // === EXTRAIR TONELADAS (formatos: "25 toneladas", "25 tons", "25t") ===
  if (!data.tons) { // só busca se ainda não encontrou pelo formato "x"
    const tonsMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:toneladas?|tons?|t\b)/i);
    if (tonsMatch) {
      data.tons = tonsMatch[1].replace(',', '.');
    }
  }

  // === EXTRAIR VALOR POR TONELADA (formatos: "a 150 reais", "valor 150", "150 por tonelada") ===
  if (!data.valor_ton && data.tons) { // só considera se já encontrou toneladas e ainda não tem valor
    const valorTonMatch = normalized.match(/(?:a|por tonelada|valor[:\s]+)?\s*r?\$?\s*(\d+(?:[.,]\d+)?)\s*(?:reais?|por tonelada)?/i);
    if (valorTonMatch) {
      data.valor_ton = valorTonMatch[1].replace(',', '.');
    }
  }

  // === EXTRAIR DIAS (formatos: "3 dias", "por 5 dias") ===
  const diasMatch = normalized.match(/(?:por\s+)?(\d+)\s*dias?/i);
  if (diasMatch && !data.tons) { // só considera se NÃO for viagem por tonelada
    data.dias = diasMatch[1];
  }

  // === EXTRAIR VALOR DIÁRIO (formatos: "500 por dia", "diária de 500") ===
  const valorDiarioMatch = normalized.match(/(?:di[aá]ria\s+de|por\s+dia|valor\s+di[aá]rio)[:\s]+r?\$?\s*(\d+(?:[.,]\d+)?)/i);
  if (valorDiarioMatch) {
    data.valor_diario = valorDiarioMatch[1].replace(',', '.');
  }

  // === EXTRAIR DATA (diversos formatos) ===
  // Formato 1: "no dia 20/05/2026", "data 20/05/2026", "em 20/05/2026"
  let dataMatch = normalized.match(/(?:no\s+dia|data|em)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (dataMatch) {
    data.data = dataMatch[1];
  }
  
  // Formato 2: "09/03" ou "9/3" (sem ano - complementar com ano atual)
  if (!data.data) {
    dataMatch = normalized.match(/(?:no\s+dia|data|em)[:\s]+(\d{1,2}\/\d{1,2})(?![\/\d])/i);
    if (dataMatch) {
      const anoAtual = new Date().getFullYear();
      data.data = `${dataMatch[1]}/${anoAtual}`;
    }
  }
  
  // Formato 3: "9 de março" ou "nove de março"
  if (!data.data) {
    const mesesPorExtenso = {
      'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
      'abril': '04', 'maio': '05', 'junho': '06',
      'julho': '07', 'agosto': '08', 'setembro': '09',
      'outubro': '10', 'novembro': '11', 'dezembro': '12'
    };
    const numerosPorExtenso = {
      'um': '1', 'dois': '2', 'três': '3', 'tres': '3', 'quatro': '4', 'cinco': '5',
      'seis': '6', 'sete': '7', 'oito': '8', 'nove': '9', 'dez': '10',
      'onze': '11', 'doze': '12', 'treze': '13', 'quatorze': '14', 'quinze': '15',
      'dezesseis': '16', 'dezessete': '17', 'dezoito': '18', 'dezenove': '19', 'vinte': '20',
      'vinte e um': '21', 'vinte e dois': '22', 'vinte e três': '23', 'vinte e tres': '23',
      'vinte e quatro': '24', 'vinte e cinco': '25', 'vinte e seis': '26', 'vinte e sete': '27',
      'vinte e oito': '28', 'vinte e nove': '29', 'trinta': '30', 'trinta e um': '31'
    };
    
    dataMatch = normalized.match(/(\d{1,2}|um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte(?:\s+e\s+(?:um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove))?|trinta(?:\s+e\s+um)?)\s+de\s+(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i);
    if (dataMatch) {
      let dia = dataMatch[1];
      const mes = mesesPorExtenso[dataMatch[2].toLowerCase()];
      
      // Converter número por extenso se necessário
      if (isNaN(dia)) {
        dia = numerosPorExtenso[dia.toLowerCase()] || dia;
      }
      
      const anoAtual = new Date().getFullYear();
      data.data = `${String(dia).padStart(2, '0')}/${mes}/${anoAtual}`;
    }
  }
  
  // Se não informou data, usar hoje
  if (!data.data) {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    data.data = `${dia}/${mes}/${ano}`;
  }

  // === EXTRAIR MODALIDADE (inferir ou explícito) ===
  if (normalized.includes('arrendamento') || normalized.includes('diaria') || normalized.includes('diária')) {
    data.modalidade = 'diaria';
  } else if (data.tons || normalized.includes('tonelada')) {
    data.modalidade = 'tonelada';
  }

  // === EXTRAIR DESCRIÇÃO (formato: "descricao: texto" ou depois de "obs:") ===
  // Formato 1: "descricao: texto", "obs: texto"
  let descricaoMatch = normalized.match(/(?:descri[cç][aã]o|obs|observa[cç][aã]o)[:\s]+(.+?)(?:\s+(?:veiculo|data|no dia|combustivel)|$)/i);
  
  // Formato 2: Texto livre entre placa e números (ex: "fazenda aurora x porto franco")
  // Captura texto entre a placa do veículo e os números de peso/valor
  if (!descricaoMatch && data.veiculo) {
    const afterVehicle = text.substring(text.toLowerCase().indexOf(data.veiculo.toLowerCase()) + data.veiculo.length);
    const beforeNumbers = afterVehicle.match(/[,\s]+(.+?)(?=\s*\d+[.,]\d+\s*x|\s*\d+\s*toneladas?|\s*gastos)/i);
    if (beforeNumbers && beforeNumbers[1].trim().length > 0) {
      let desc = beforeNumbers[1].trim();
      
      // Remover padrões de data da descrição capturada
      // Remove "no dia 09/03", "no dia 20/05/2026", "data 09/03", "em 09/03"
      desc = desc.replace(/(?:no\s+dia|data|em)[:\s]+\d{1,2}\/\d{1,2}(?:\/\d{4})?[,\s]*/gi, '');
      
      // Remove "no dia 9 de março", "no dia nove de março", "data 9 de março", "em 9 de março"
      desc = desc.replace(/(?:no\s+dia|data|em)[:\s]+(?:\d+|um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte(?:\s+e\s+(?:um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove))?|trinta(?:\s+e\s+um)?)\s+de\s+(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[,\s]*/gi, '');
      
      // Remove "9 de março", "nove de março" sem prefixo (caso sobrou)
      desc = desc.replace(/^\s*(?:\d+|um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte(?:\s+e\s+(?:um|dois|tr[êe]s|quatro|cinco|seis|sete|oito|nove))?|trinta(?:\s+e\s+um)?)\s+de\s+(?:janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[,\s]*/gi, '');
      
      // Remover qualquer texto após palavras-chave de gastos/combustível
      desc = desc.replace(/\s*(gastos|combustivel).*$/i, '');
      
      // Limpar separadores extras no início e fim
      desc = desc.replace(/^[,\s-]+|[,\s-]+$/g, '');
      
      if (desc.length > 0) {
        data.descricao = desc;
      }
    }
  }
  
  if (descricaoMatch) {
    data.descricao = descricaoMatch[1].trim();
  }

  // === EXTRAIR COMBUSTÍVEL ===
  // Formato 1: "combustivel: 2000.15" ou "combustivel 2000,15"
  let combustivelMatch = normalized.match(/combust[ií]vel[:\s]+r?\$?\s*(\d+(?:[.,]\d+)?)/i);
  // Formato 2: "Gastos com combustiveis" seguido de valor na próxima linha/sequência
  if (!combustivelMatch) {
    combustivelMatch = normalized.match(/gastos\s+com\s+combust[ií]ve(?:l|is)[\s\n]*r?\$?\s*(\d+(?:[.,]\d+)?)/i);
  }
  if (combustivelMatch) {
    data.combustivel = combustivelMatch[1].replace(',', '.');
  }

  // === EXTRAIR OUTROS GASTOS ===
  // Formato 1: "outros gastos: 150" ou "gastos: 150"
  let outrosMatch = normalized.match(/(?:outros\s+gastos|gastos)[:\s]+r?\$?\s*(\d+(?:[.,]\d+)?)/i);
  // Formato 2: "Gastos gerais" seguido de "150,00 - borracharia"
  let gastoGeralDescricao = null;
  if (!outrosMatch) {
    const gastosGeraisMatch = normalized.match(/gastos\s+gerais[\s\n]*r?\$?\s*(\d+(?:[.,]\d+)?)(?:\s*-\s*([^-\n]+?))?(?=\s*(?:gastos|combustivel|km\s+inicial|km\s+final|\d+[.,]\d+\s*x|$))/i);
    if (gastosGeraisMatch) {
      outrosMatch = gastosGeraisMatch;
      // Armazenar a descrição do gasto separadamente, limpando espaços e texto extra
      if (gastosGeraisMatch[2]) {
        let desc = gastosGeraisMatch[2].trim();
        // Remover qualquer texto após palavras-chave
        desc = desc.replace(/\s*(gastos|combustivel|km\s+inicial|km\s+final).*$/i, '');
        gastoGeralDescricao = desc.trim();
      }
    }
  }
  if (outrosMatch) {
    data.outros_gastos = outrosMatch[1].replace(',', '.');
  }
  // Guardar a descrição do gasto geral separadamente
  if (gastoGeralDescricao) {
    data.gasto_geral_descricao = gastoGeralDescricao;
  }

  // === EXTRAIR KM INICIAL/FINAL ===
  const kmInicialMatch = normalized.match(/km\s+inicial[:\s]+(\d+)/i);
  if (kmInicialMatch) {
    data.km_inicial = kmInicialMatch[1];
  }
  const kmFinalMatch = normalized.match(/km\s+final[:\s]+(\d+)/i);
  if (kmFinalMatch) {
    data.km_final = kmFinalMatch[1];
  }

  return { data };
};

/**
 * Normaliza os dados parseados para o formato da API de viagens.
 */
const normalizeViagemData = async (parsed) => {
  const { data } = parsed;
  
  // Validações básicas
  if (!data.veiculo) {
    return { error: 'Campo "Veículo" é obrigatório. Exemplo: "veiculo ABC1234" ou "no veiculo AAA1236"' };
  }

  // Buscar veículo por placa
  let vehicle = null;
  try {
    const vehicles = await transportService.getVehicles({ no_page: '1' });
    const allVehicles = vehicles.results || vehicles || [];
    vehicle = allVehicles.find((v) => 
      v.plate.toUpperCase() === data.veiculo.toUpperCase()
    );
    if (!vehicle) {
      return { error: `Veículo com placa "${data.veiculo}" não foi encontrado no sistema. Verifique se a placa está correta.` };
    }
  } catch (err) {
    return { error: 'Erro ao buscar veículo no sistema: ' + (err.message || 'erro desconhecido') };
  }

  // Determinar modalidade
  const modalidadeInput = (data.modalidade || '').toLowerCase();
  let modality = 'per_ton';
  if (modalidadeInput.includes('diaria') || modalidadeInput.includes('arrendamento')) {
    modality = 'lease';
  }

  // Parsear data (dd/mm/aaaa ou ISO)
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return dateStr; // assume ISO
  };

  const startDate = parseDate(data.data || data.data_inicio) || new Date().toISOString().slice(0, 10);
  const endDate = parseDate(data.data_fim) || null;

  // Parsear valores monetários (aceitar vírgula e ponto)
  const parseMoney = (val) => {
    if (!val) return 0;
    const str = String(val).trim();
    
    // Se tem vírgula, assumir formato brasileiro: 1.234,56 ou 51,72
    if (str.includes(',')) {
      // Remove pontos (separadores de milhar) e substitui vírgula por ponto (decimal)
      const normalized = str.replace(/\./g, '').replace(',', '.');
      return Number(normalized) || 0;
    }
    
    // Se não tem vírgula, verificar se é formato com múltiplos pontos (ex: 1.234.567)
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Múltiplos pontos = separadores de milhar, remover todos
      const normalized = str.replace(/\./g, '');
      return Number(normalized) || 0;
    }
    
    // Único ponto ou nenhum = formato US ou número inteiro
    return Number(str) || 0;
  };

  const payload = {
    vehicle: vehicle.id,
    date: startDate,
    start_date: startDate,
    end_date: endDate,
    modality,
    progress_type: data.andamento || '',
    description: data.descricao || '',
    is_received: false,
    base_expense_value: parseMoney(data.outros_gastos || 0),
    fuel_expense_value: parseMoney(data.combustivel || 0),
    initial_km: data.km_inicial ? Number(data.km_inicial) : null,
    final_km: data.km_final ? Number(data.km_final) : null,
  };

  // Se houver descrição do gasto geral, adicionar ao final com marcador
  if (data.gasto_geral_descricao) {
    payload.description = payload.description 
      ? `${payload.description} [GASTO:${data.gasto_geral_descricao}]`
      : `[GASTO:${data.gasto_geral_descricao}]`;
  }

  if (modality === 'per_ton') {
    const tons = parseMoney(data.tons || data.toneladas || 0);
    const ratePerTon = parseMoney(data.valor_ton || data.valor_tonelada || 0);
    if (tons === 0 || ratePerTon === 0) {
      return { error: 'Para modalidade "Por Tonelada", informe as toneladas e o valor por tonelada. Exemplo: "49.61 x 123" ou "49.61 toneladas a 123 reais"' };
    }
    payload.tons = tons;
    payload.rate_per_ton = ratePerTon;
    payload.days = null;
    payload.daily_rate = null;
  } else {
    const days = Number(data.dias || 0);
    const dailyRate = parseMoney(data.valor_diario || 0);
    if (days === 0 || dailyRate === 0) {
      return { error: 'Para modalidade "Arrendamento", informe os dias e o valor diário. Exemplo: "3 dias a 500 reais por dia"' };
    }
    payload.days = days;
    payload.daily_rate = dailyRate;
    payload.tons = null;
    payload.rate_per_ton = null;
  }

  // Pagamento do motorista (padrão: tipo 1 = manual, valor 0)
  payload.driver_receive_type = '1';
  payload.driver_payment = parseMoney(data.motorista || 0);

  return { payload };
};

export default function ChatWidget({ open, onClose }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Olá! 👋 Eu posso ajudar você a criar viagens de forma rápida e natural!\n\n📝 **Como usar:**\nDigite de forma natural em português. Não precisa se preocupar com formatação rígida!\n\n💡 **Exemplos práticos:**\n\n• "adicionar viagem veiculo ABC1234 - 25 toneladas a 150 reais no dia 20/05/2026"\n\n• "nova viagem vaiculo DEF5678 por 3 dias a 500 reais por dia"\n\n• "criar viagem veiculo GHI9012 - peso 48.14 x 177 ton"\n\n• "Adicionar viagem, Viagem do veiculo XXX1234 no dia 09/03, fazenda aurora x porto franco, 51,72 x 120 ton\nGastos gerais 150,00 - borracharia\nGastos com combustiveis 2000,15"\n\n• "Viagem do veiculo AAA1236 no dia 9 de março, fazenda planeste, 48,5 x 115 ton"\n\n✨ **Dica:** Se não informar a data, usarei a data de hoje automaticamente! 😊',
    },
  ]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [pendingTrip, setPendingTrip] = useState(null); // Armazena dados parciais da tentativa anterior
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || processing) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    setProcessing(true);

    try {
      // Se houver tentativa pendente, parsear como complemento (sem exigir comando)
      let parsed;
      if (pendingTrip) {
        // Tentar parsear a mensagem como complemento
        const complementParsed = parseViagemMessage('adicionar viagem ' + userMessage);
        if (!complementParsed.error && complementParsed.data) {
          // Mesclar dados: manter dados anteriores e adicionar/sobrescrever com novos
          parsed = {
            data: { ...pendingTrip, ...complementParsed.data }
          };
        } else {
          // Se não conseguiu parsear, tentar usar a mensagem direta como dados
          parsed = { data: { ...pendingTrip } };
        }
      } else {
        // Primeira tentativa: parsear normalmente
        parsed = parseViagemMessage(userMessage);
        if (parsed.error) {
          setMessages((prev) => [...prev, { role: 'assistant', text: `❌ ${parsed.error}` }]);
          return;
        }
      }

      // Normalizar dados
      const normalized = await normalizeViagemData(parsed);
      if (normalized.error) {
        // Guardar dados parciais para continuação
        setPendingTrip(parsed.data);
        
        // Montar mensagem de erro mais amigável com o que falta
        let helpMsg = `❌ ${normalized.error}\n\n`;
        helpMsg += '📝 **Informações já capturadas:**\n';
        
        if (parsed.data.veiculo) helpMsg += `✓ Veículo: ${parsed.data.veiculo}\n`;
        if (parsed.data.tons) helpMsg += `✓ Toneladas: ${parsed.data.tons}\n`;
        if (parsed.data.valor_ton) helpMsg += `✓ Valor por Tonelada: R$ ${parsed.data.valor_ton}\n`;
        if (parsed.data.dias) helpMsg += `✓ Dias: ${parsed.data.dias}\n`;
        if (parsed.data.valor_diario) helpMsg += `✓ Valor Diário: R$ ${parsed.data.valor_diario}\n`;
        if (parsed.data.data) helpMsg += `✓ Data: ${parsed.data.data}\n`;
        if (parsed.data.descricao) helpMsg += `✓ Descrição: ${parsed.data.descricao}\n`;
        
        helpMsg += '\n💡 **Envie as informações que faltam para completar o cadastro:**\n\n';
        helpMsg += 'Exemplos:\n';
        if (!parsed.data.veiculo) helpMsg += '• "veiculo ABC1234" ou "no veiculo AAA1236"\n';
        if (!parsed.data.tons && !parsed.data.dias) {
          helpMsg += '• "25 toneladas" ou "49.61 x 123"\n';
          helpMsg += '• "3 dias"\n';
        }
        if (!parsed.data.valor_ton && !parsed.data.valor_diario) {
          helpMsg += '• "a 150 reais por tonelada"\n';
          helpMsg += '• "500 reais por dia"\n';
        }
        
        setMessages((prev) => [...prev, { role: 'assistant', text: helpMsg }]);
        return;
      }

      // Criar viagem via API
      const created = await transportService.createTrip(normalized.payload);
      
      // Limpar tentativa pendente após sucesso
      setPendingTrip(null);
      
      // Adicionar mensagem especial com ações
      const modalityText = created.modality === 'per_ton' ? 'Por Tonelada' : 'Arrendamento (Diária)';
      setMessages((prev) => [...prev, { 
        role: 'assistant', 
        type: 'tripCreated',
        tripData: {
          id: created.id,
          vehicle: created.vehicle_plate || created.vehicle,
          modality: modalityText,
          totalValue: Number(created.total_value || 0).toFixed(2),
          date: created.start_date || created.date
        }
      }]);
      toast('Viagem criada via chat!', 'success');
    } catch (err) {
      console.error('Erro ao criar viagem via chat:', err);
      
      // Montar mensagem de erro da API
      let errMsg = '❌ **Não foi possível criar a viagem.**\n\n';
      
      if (err.response?.data) {
        const errorData = err.response.data;
        errMsg += '📋 **Detalhes do erro:**\n';
        
        // Mostrar erros de campo específicos traduzidos
        if (typeof errorData === 'object' && !Array.isArray(errorData)) {
          let hasFieldErrors = false;
          Object.keys(errorData).forEach(field => {
            hasFieldErrors = true;
            const fieldErrors = Array.isArray(errorData[field]) 
              ? errorData[field].join(', ') 
              : errorData[field];
            const translatedField = translateFieldName(field);
            errMsg += `• **${translatedField}**: ${fieldErrors}\n`;
          });
          
          if (!hasFieldErrors) {
            errMsg += JSON.stringify(errorData);
          }
        } else {
          errMsg += JSON.stringify(errorData);
        }
        
        // Se houver dados parciais, manter contexto
        if (pendingTrip) {
          errMsg += '\n\n💡 Você pode complementar as informações ou corrigir os dados e tentar novamente.';
        } else {
          errMsg += '\n\n💡 Verifique os dados e tente novamente.';
        }
      } else {
        errMsg += `Erro: ${err.message || 'Erro desconhecido ao comunicar com o servidor'}\n\n`;
        errMsg += '💡 Verifique sua conexão e tente novamente.';
      }
      
      setMessages((prev) => [...prev, { role: 'assistant', text: errMsg }]);
    } finally {
      setProcessing(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCancelTrip = async (tripId) => {
    try {
      await transportService.deleteTrip(tripId);
      toast('Viagem cancelada com sucesso', 'success');
      setMessages((prev) => [...prev, { 
        role: 'assistant', 
        text: '✅ Viagem cancelada e removida do sistema.' 
      }]);
    } catch (err) {
      console.error('Erro ao cancelar viagem:', err);
      toast('Erro ao cancelar viagem', 'error');
      setMessages((prev) => [...prev, { 
        role: 'assistant', 
        text: '❌ Não foi possível cancelar a viagem. Tente novamente ou acesse a página de gerenciamento.' 
      }]);
    }
  };

  const handleAccessTrip = (tripId) => {
    navigate(`/transport/trips?trip=${tripId}`);
    onClose(); // Fechar o chat ao navegar
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="text-xl">💬</span>
          <h3 className="font-semibold">Chat Assistente</h3>
        </div>
        <button onClick={onClose} className="text-white hover:text-gray-200 text-xl">
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg, idx) => {
          // Renderização especial para viagem criada
          if (msg.type === 'tripCreated' && msg.tripData) {
            return (
              <div key={idx} className="flex justify-start">
                <div className="max-w-[85%] bg-green-50 border-2 border-green-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">✅</span>
                    <h4 className="font-bold text-green-800 text-lg">Viagem criada com sucesso!</h4>
                  </div>
                  
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">ID:</span>
                      <span className="font-semibold text-gray-900">#{msg.tripData.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Veículo:</span>
                      <span className="font-semibold text-gray-900">{msg.tripData.vehicle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Modalidade:</span>
                      <span className="font-semibold text-gray-900">{msg.tripData.modality}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor Total:</span>
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
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                    >
                      📋 Acessar Viagem
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Tem certeza que deseja cancelar e excluir esta viagem?')) {
                          handleCancelTrip(msg.tripData.id);
                        }
                      }}
                      className="flex-1 bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors font-medium text-sm border border-red-300"
                    >
                      ❌ Cancelar
                    </button>
                  </div>
                </div>
              </div>
            );
          }
          
          // Renderização padrão de mensagens
          return (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-lg whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        {processing && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-800 border border-gray-200 px-4 py-2 rounded-lg">
              <span className="animate-pulse">Processando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-white rounded-b-xl">
        {pendingTrip && (
          <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-amber-600">⚠️</span>
              <span className="text-amber-800">Complementando viagem anterior...</span>
            </div>
            <button
              onClick={() => {
                setPendingTrip(null);
                setMessages((prev) => [...prev, { 
                  role: 'assistant', 
                  text: '🔄 Tentativa anterior cancelada. Você pode começar uma nova viagem!' 
                }]);
              }}
              className="text-amber-600 hover:text-amber-800 font-medium"
              title="Cancelar e começar do zero"
            >
              ✕ Cancelar
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
            onKeyPress={handleKeyPress}
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

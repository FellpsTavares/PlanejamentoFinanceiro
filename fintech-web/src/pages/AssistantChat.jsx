import { useEffect, useMemo, useState } from 'react';
import { assistantService } from '../services/assistant';

const INTENT_LABELS = {
  finance_transaction: 'Lançamento financeiro',
  trip_create: 'Criação de viagem',
  trip_movement: 'Lançamento em viagem',
  unknown: 'Não identificado',
};

const PROVIDER_LABELS = {
  'rule-based': 'Regra local',
  gemini: 'Gemini',
};

const FIELD_LABELS = {
  message: 'mensagem',
  intent: 'tipo de ação',
  plate: 'placa do veículo',
  modality: 'modalidade da viagem',
  tons: 'quantidade em toneladas',
  rate_per_ton: 'valor por tonelada',
  days: 'quantidade de dias',
  daily_rate: 'valor da diária',
  amount: 'valor',
  type: 'tipo (receita ou despesa)',
  date: 'data',
  transaction_date: 'data da transação',
  movement_type: 'tipo do lançamento da viagem',
  expense_category: 'categoria do gasto',
  description: 'descrição',
};

const INTENT_HELP = {
  finance_transaction: 'Exemplo: "Lançar despesa de 350,00 hoje com combustível".',
  trip_create: 'Exemplo: "Criar viagem para ABC1D23 por tonelada 20 toneladas valor tonelada 220".',
  trip_movement: 'Exemplo: "Lançar gasto da viagem ABC1D23 de 450,00 combustível hoje".',
  unknown: 'Tente informar claramente se é lançamento financeiro, criação de viagem ou lançamento em viagem.',
};

const INTENT_FIELDS = {
  finance_transaction: ['type', 'amount', 'transaction_date', 'description'],
  trip_create: ['plate', 'modality', 'tons', 'rate_per_ton', 'days', 'daily_rate', 'start_date', 'description'],
  trip_movement: ['plate', 'movement_type', 'expense_category', 'amount', 'date', 'description'],
};

const FIELD_TYPES = {
  plate: 'text',
  modality: 'select',
  tons: 'number',
  rate_per_ton: 'number',
  days: 'number',
  daily_rate: 'number',
  amount: 'number',
  type: 'select',
  date: 'date',
  transaction_date: 'date',
  movement_type: 'select',
  expense_category: 'select',
  description: 'textarea',
};

const FIELD_SELECT_OPTIONS = {
  modality: [
    { value: 'per_ton', label: 'Por tonelada' },
    { value: 'lease', label: 'Arrendamento (diária)' },
  ],
  type: [
    { value: 'income', label: 'Receita' },
    { value: 'expense', label: 'Despesa' },
  ],
  movement_type: [
    { value: 'revenue', label: 'Recebimento' },
    { value: 'expense', label: 'Gasto' },
  ],
  expense_category: [
    { value: 'fuel', label: 'Combustível' },
    { value: 'other', label: 'Outros' },
  ],
};

const TEMPLATE_STORAGE_KEY = 'assistant_client_templates_v1';

function getTodayIso() {
  return new Date().toISOString().split('T')[0];
}

const CLIENT_PROMPT_SCRIPTS = [
  {
    key: 'trip-create',
    title: 'Template: Nova viagem',
    template: 'Criar viagem para placa {{plate}} por tonelada {{tons}} toneladas valor tonelada {{rate_per_ton}} com data {{start_date}} descricao {{description}}.',
    fields: [
      { key: 'plate', label: 'Placa', type: 'text', required: true, placeholder: 'ABC1D23', defaultValue: '' },
      { key: 'tons', label: 'Toneladas', type: 'number', required: true, placeholder: '20', defaultValue: '' },
      { key: 'rate_per_ton', label: 'Valor por tonelada', type: 'number', required: true, placeholder: '220', defaultValue: '' },
      { key: 'start_date', label: 'Data', type: 'date', required: true, defaultValue: getTodayIso() },
      { key: 'description', label: 'Descricao', type: 'text', required: false, placeholder: 'Frete soja', defaultValue: 'Viagem via template' },
    ],
  },
  {
    key: 'finance-expense',
    title: 'Template: Debito',
    template: 'Lancar despesa no valor de {{amount}} na data {{transaction_date}} com descricao {{description}}.',
    fields: [
      { key: 'amount', label: 'Valor', type: 'number', required: true, placeholder: '350', defaultValue: '' },
      { key: 'transaction_date', label: 'Data', type: 'date', required: true, defaultValue: getTodayIso() },
      { key: 'description', label: 'Descricao', type: 'text', required: true, placeholder: 'Combustivel', defaultValue: '' },
    ],
  },
  {
    key: 'finance-income',
    title: 'Template: Receita',
    template: 'Lancar receita no valor de {{amount}} na data {{transaction_date}} com descricao {{description}}.',
    fields: [
      { key: 'amount', label: 'Valor', type: 'number', required: true, placeholder: '1200', defaultValue: '' },
      { key: 'transaction_date', label: 'Data', type: 'date', required: true, defaultValue: getTodayIso() },
      { key: 'description', label: 'Descricao', type: 'text', required: true, placeholder: 'Pagamento frete', defaultValue: '' },
    ],
  },
];

function getDefaultTemplateValues() {
  return CLIENT_PROMPT_SCRIPTS.reduce((acc, script) => {
    acc[script.key] = (script.fields || []).reduce((fieldAcc, field) => {
      fieldAcc[field.key] = field.defaultValue ?? '';
      return fieldAcc;
    }, {});
    return acc;
  }, {});
}

function loadTemplateValues() {
  const defaults = getDefaultTemplateValues();
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;

    const merged = { ...defaults };
    Object.keys(defaults).forEach((scriptKey) => {
      const current = parsed[scriptKey] || {};
      merged[scriptKey] = { ...defaults[scriptKey], ...current };
    });
    return merged;
  } catch (err) {
    return defaults;
  }
}

const NUMERIC_FIELDS = new Set(['tons', 'rate_per_ton', 'days', 'daily_rate', 'amount']);

function isEmpty(value) {
  return value === null || value === undefined || value === '';
}

function computeMissingFields(intent, draft) {
  const data = draft || {};
  if (!intent || intent === 'unknown') return ['intent'];

  if (intent === 'finance_transaction') {
    const missing = [];
    if (!['income', 'expense'].includes(data.type)) missing.push('type');
    if (isEmpty(data.amount)) missing.push('amount');
    if (isEmpty(data.transaction_date)) missing.push('transaction_date');
    return missing;
  }

  if (intent === 'trip_create') {
    const missing = [];
    if (isEmpty(data.plate)) missing.push('plate');
    if (!['per_ton', 'lease'].includes(data.modality)) missing.push('modality');
    if (isEmpty(data.start_date)) missing.push('start_date');

    if (data.modality === 'per_ton') {
      if (isEmpty(data.tons)) missing.push('tons');
      if (isEmpty(data.rate_per_ton)) missing.push('rate_per_ton');
    }
    if (data.modality === 'lease') {
      if (isEmpty(data.days)) missing.push('days');
      if (isEmpty(data.daily_rate)) missing.push('daily_rate');
    }
    return missing;
  }

  if (intent === 'trip_movement') {
    const missing = [];
    if (isEmpty(data.plate)) missing.push('plate');
    if (!['revenue', 'expense'].includes(data.movement_type)) missing.push('movement_type');
    if (isEmpty(data.amount)) missing.push('amount');
    if (isEmpty(data.date)) missing.push('date');
    if (data.movement_type === 'expense' && !['fuel', 'other'].includes(data.expense_category)) {
      missing.push('expense_category');
    }
    return missing;
  }

  return [];
}

export default function AssistantChat() {
  const [message, setMessage] = useState('');
  const [loadingParse, setLoadingParse] = useState(false);
  const [loadingExecute, setLoadingExecute] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [templateValues, setTemplateValues] = useState(() => loadTemplateValues());

  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templateValues));
    } catch (err) {
      // ignore localStorage write errors
    }
  }, [templateValues]);

  const computedMissingFields = useMemo(() => {
    if (!result) return [];
    return computeMissingFields(result.intent, result.draft || {});
  }, [result]);

  const canExecute = useMemo(() => {
    if (!result) return false;
    if (!result.intent || result.intent === 'unknown') return false;
    return computedMissingFields.length === 0;
  }, [result, computedMissingFields]);

  const missingLabels = useMemo(() => {
    if (!computedMissingFields.length) return [];
    return computedMissingFields.map((field) => FIELD_LABELS[field] || field);
  }, [computedMissingFields]);

  const helpText = useMemo(() => {
    if (!result) return '';
    return INTENT_HELP[result.intent] || INTENT_HELP.unknown;
  }, [result]);

  const editableFields = useMemo(() => {
    if (!result?.intent) return [];
    const fields = INTENT_FIELDS[result.intent] || [];
    const modality = result?.draft?.modality;
    const movementType = result?.draft?.movement_type;

    return fields.filter((field) => {
      if (result.intent === 'trip_create' && modality === 'per_ton' && ['days', 'daily_rate'].includes(field)) return false;
      if (result.intent === 'trip_create' && modality === 'lease' && ['tons', 'rate_per_ton'].includes(field)) return false;
      if (result.intent === 'trip_movement' && movementType !== 'expense' && field === 'expense_category') return false;
      return true;
    });
  }, [result]);

  const setDraftField = (field, value) => {
    setResult((prev) => {
      if (!prev) return prev;
      let parsed = value;
      if (NUMERIC_FIELDS.has(field)) {
        if (value === '' || value === null || value === undefined) {
          parsed = null;
        } else {
          const normalized = Number(String(value).replace(',', '.'));
          parsed = Number.isNaN(normalized) ? null : normalized;
        }
      }
      return {
        ...prev,
        draft: {
          ...(prev.draft || {}),
          [field]: parsed,
        },
      };
    });
  };

  const getFieldValue = (field) => {
    const value = result?.draft?.[field];
    if (value === null || value === undefined) return '';
    return String(value);
  };

  const buildTemplateText = (script) => {
    const values = templateValues?.[script.key] || {};
    let text = script.template;
    (script.fields || []).forEach((field) => {
      const value = values[field.key] ?? '';
      text = text.replace(`{{${field.key}}}`, String(value).trim());
    });
    return text.replace(/\s+/g, ' ').trim();
  };

  const getTemplateMissingFields = (script) => {
    const values = templateValues?.[script.key] || {};
    return (script.fields || [])
      .filter((field) => field.required && isEmpty(values[field.key]))
      .map((field) => field.label);
  };

  const updateTemplateField = (scriptKey, fieldKey, value) => {
    setTemplateValues((prev) => ({
      ...prev,
      [scriptKey]: {
        ...(prev?.[scriptKey] || {}),
        [fieldKey]: value,
      },
    }));
  };

  const applyScript = (script) => {
    const built = buildTemplateText(script);
    setMessage(built);
    setInfo('Template aplicado no campo de mensagem com os dados preenchidos.');
  };

  const copyScript = async (script) => {
    const built = buildTemplateText(script);
    try {
      await navigator.clipboard.writeText(built);
      setInfo('Template preenchido copiado para a área de transferência.');
    } catch (err) {
      setInfo('Não foi possível copiar automaticamente. Selecione e copie manualmente.');
    }
  };

  const parseMessage = async (rawMessage) => {
    const finalMessage = (rawMessage || '').trim();
    if (!finalMessage) return;

    setLoadingParse(true);
    setError('');
    setInfo('');
    try {
      const parsed = await assistantService.parse(finalMessage);
      setResult({ ...parsed, draft: parsed?.draft || {} });
      const resumo = [
        `Ação identificada: ${INTENT_LABELS[parsed.intent] || parsed.intent}`,
        `Mecanismo: ${PROVIDER_LABELS[parsed.provider] || parsed.provider || 'n/a'}`,
        (parsed.missing_fields || []).length
          ? `Faltam: ${(parsed.missing_fields || []).map((field) => FIELD_LABELS[field] || field).join(', ')}`
          : 'Tudo certo, já pode confirmar e executar.',
      ].join('\n');

      setHistory((prev) => [...prev, { type: 'user', text: finalMessage }, { type: 'assistant', text: resumo }]);
      setMessage('');
    } catch (err) {
      console.error(err);
      setError('Não foi possível interpretar sua mensagem agora.');
    } finally {
      setLoadingParse(false);
    }
  };

  const parseTemplate = async (script) => {
    const missing = getTemplateMissingFields(script);
    if (missing.length > 0) {
      setError(`Preencha os campos obrigatórios do template: ${missing.join(', ')}`);
      return;
    }
    const built = buildTemplateText(script);
    await parseMessage(built);
  };

  const handleParse = async (e) => {
    e.preventDefault();
    await parseMessage(message);
  };

  const handleExecute = async () => {
    if (!result || !canExecute) return;

    setLoadingExecute(true);
    setError('');
    setInfo('');
    try {
      const exec = await assistantService.execute(result.intent, result.draft || {});
      setHistory((prev) => [...prev, { type: 'assistant', text: `Execução concluída: ${JSON.stringify(exec)}` }]);
      setInfo('Ação executada com sucesso.');
      setResult(null);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || 'Erro ao executar ação do assistente.');
    } finally {
      setLoadingExecute(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Assistente Operacional</h1>
        <p className="text-sm text-slate-600 mt-1">
          Digite em linguagem natural para lançar no financeiro ou registrar operações de viagem.
        </p>
      </div>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Templates padrão para clientes</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {CLIENT_PROMPT_SCRIPTS.map((script) => (
            <article key={script.key} className="rounded-lg border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-900">{script.title}</h3>
              <p className="mt-2 text-xs text-slate-600">{script.template}</p>

              <div className="mt-3 grid grid-cols-1 gap-2">
                {(script.fields || []).map((field) => (
                  <label key={`${script.key}-${field.key}`} className="text-xs text-slate-700">
                    <span className="mb-1 block">{field.label}{field.required ? ' *' : ''}</span>
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={templateValues?.[script.key]?.[field.key] ?? ''}
                      onChange={(e) => updateTemplateField(script.key, field.key, e.target.value)}
                      placeholder={field.placeholder || ''}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                      step={field.type === 'number' ? '0.01' : undefined}
                    />
                  </label>
                ))}
              </div>

              <div className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                <strong>Preview:</strong> {buildTemplateText(script)}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => applyScript(script)}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  Usar no chat
                </button>
                <button
                  type="button"
                  onClick={() => parseTemplate(script)}
                  className="rounded-md border border-emerald-400 px-3 py-1.5 text-xs font-medium text-emerald-700"
                >
                  Interpretar template
                </button>
                <button
                  type="button"
                  onClick={() => copyScript(script)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                >
                  Copiar template
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <form onSubmit={handleParse} className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ex.: lançar despesa de 350,00 hoje combustível do caminhão ABC1D23"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={loadingParse}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {loadingParse ? 'Analisando...' : 'Enviar'}
            </button>
          </form>

          {info && <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</div>}

          {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="mt-4 space-y-2 max-h-[420px] overflow-auto pr-1">
            {history.length === 0 && (
              <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
                Exemplos: "criar viagem para ABC1D23 por tonelada 18 toneladas valor tonelada 220" ou "lance uma receita de 1200 hoje".
              </div>
            )}
            {history.map((item, idx) => (
              <div
                key={`${item.type}-${idx}`}
                className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${item.type === 'user' ? 'bg-blue-50 text-blue-900' : 'bg-slate-50 text-slate-800'}`}
              >
                <strong className="mr-1">{item.type === 'user' ? 'Você:' : 'Assistente:'}</strong>
                {item.text}
              </div>
            ))}
          </div>
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Prévia da ação</h2>

          {!result && <p className="mt-3 text-sm text-slate-500">Nenhuma análise realizada.</p>}

          {result && (
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs text-slate-500">Tipo de ação</div>
                <div className="font-medium">{INTENT_LABELS[result.intent] || result.intent}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Mecanismo</div>
                <div className="font-medium">{PROVIDER_LABELS[result.provider] || result.provider || 'n/a'}</div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">Dados identificados</div>
                <pre className="rounded bg-slate-50 p-2 text-xs overflow-auto">{JSON.stringify(result.draft || {}, null, 2)}</pre>
              </div>

              {!!editableFields.length && (
                <div>
                  <div className="text-xs text-slate-500 mb-2">Completar/editar dados (sem nova mensagem)</div>
                  <div className="space-y-2">
                    {editableFields.map((field) => {
                      const label = FIELD_LABELS[field] || field;
                      const fieldType = FIELD_TYPES[field] || 'text';
                      const value = getFieldValue(field);
                      const isPending = computedMissingFields.includes(field);

                      return (
                        <div key={field}>
                          <label className="mb-1 block text-xs font-medium text-slate-700">
                            {label} {isPending ? <span className="text-amber-700">(pendente)</span> : null}
                          </label>

                          {fieldType === 'select' && (
                            <select
                              value={value}
                              onChange={(e) => setDraftField(field, e.target.value)}
                              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                            >
                              <option value="">Selecione...</option>
                              {(FIELD_SELECT_OPTIONS[field] || []).map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          )}

                          {fieldType === 'textarea' && (
                            <textarea
                              value={value}
                              onChange={(e) => setDraftField(field, e.target.value)}
                              rows={2}
                              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                            />
                          )}

                          {(fieldType === 'text' || fieldType === 'number' || fieldType === 'date') && (
                            <input
                              type={fieldType}
                              value={value}
                              onChange={(e) => setDraftField(field, e.target.value)}
                              step={fieldType === 'number' ? '0.01' : undefined}
                              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-slate-500">Campos pendentes</div>
                {missingLabels.length ? (
                  <ul className="mt-1 list-disc pl-5 text-sm text-amber-700">
                    {missingLabels.map((field) => <li key={field}>{field}</li>)}
                  </ul>
                ) : (
                  <div className="text-sm text-emerald-700">Sem pendências.</div>
                )}
              </div>

              {helpText && (
                <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  <strong>Dica:</strong> {helpText}
                </div>
              )}

              <button
                type="button"
                disabled={!canExecute || loadingExecute}
                onClick={handleExecute}
                className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {loadingExecute ? 'Executando...' : 'Confirmar e Executar'}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

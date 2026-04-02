import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { reportsService } from '../services/reports';
import ToggleChip from '../components/ToggleChip';
import { toast } from '../utils/toast';

const REPORT_CONFIGS = {
  initial: {
    title: 'Finanças',
    fields: [
      { key: 'transaction_date', label: 'Data' },
      { key: 'description', label: 'Descrição' },
      { key: 'category', label: 'Categoria' },
      { key: 'type', label: 'Tipo' },
      { key: 'amount', label: 'Valor' },
      { key: 'status', label: 'Status' },
    ],
    orderBy: [
      { key: 'transaction_date', label: 'Data da transação' },
      { key: 'amount', label: 'Valor' },
      { key: 'created_at', label: 'Data de criação' },
    ],
  },
  transport: {
    title: 'Transportadora',
    fields: [
      { key: 'vehicle', label: 'Veículo' },
      { key: 'start_date', label: 'Início' },
      { key: 'end_date', label: 'Fim' },
      { key: 'status', label: 'Status' },
      { key: 'total_value', label: 'Valor Bruto' },
      { key: 'expense_value', label: 'Total Despesas' },
      { key: 'net_value', label: 'Líquido' },
    ],
    orderBy: [
      { key: 'start_date', label: 'Data de início' },
      { key: 'end_date', label: 'Data de fim' },
      { key: 'vehicle', label: 'Veículo' },
      { key: 'status', label: 'Status' },
    ],
  },
  investments: {
    title: 'Investimentos',
    fields: [
      { key: 'ticker', label: 'Ticker' },
      { key: 'quantity', label: 'Quantidade' },
      { key: 'buy_price', label: 'Preço compra' },
      { key: 'current_price', label: 'Preço atual' },
      { key: 'pnl', label: 'PnL' },
    ],
    orderBy: [
      { key: 'buy_date', label: 'Data de compra' },
      { key: 'ticker', label: 'Ticker' },
    ],
  },
};

export default function Reports() {
  const [searchParams] = useSearchParams();
  const moduleKey = useMemo(() => searchParams.get('module') || 'initial', [searchParams]);
  const config = REPORT_CONFIGS[moduleKey] || REPORT_CONFIGS.initial;

  const [selectedFields, setSelectedFields] = useState(config.fields.map((f) => f.key));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [orderBy, setOrderBy] = useState(config.orderBy[0]?.key || '');
  const [orderDir, setOrderDir] = useState('desc');
  const [paperSize, setPaperSize] = useState('A4');
  const [orientation, setOrientation] = useState('portrait');
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    setSelectedFields(config.fields.map((f) => f.key));
    setOrderBy(config.orderBy[0]?.key || '');
  }, [moduleKey]);

  const toggleField = (fieldKey) => {
    setSelectedFields((prev) => (prev.includes(fieldKey) ? prev.filter((f) => f !== fieldKey) : [...prev, fieldKey]));
  };

  const buildParams = () => ({
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    fields: selectedFields.join(','),
    order_by: orderBy,
    order_dir: orderDir,
    paper: paperSize,
    orientation,
  });

  const handlePreview = async () => {
    setLoading(true);
    try {
      const params = buildParams();
      let blob;
      if (moduleKey === 'initial') blob = await reportsService.fetchFinancePdf(params);
      if (moduleKey === 'transport') blob = await reportsService.fetchTransportPdf(params);
      if (moduleKey === 'investments') blob = await reportsService.fetchInvestmentsPdf(params);

      const objectUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      setPreviewUrl(objectUrl);
      toast('Preview gerado abaixo (pode abrir em nova aba)', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro ao gerar preview do PDF', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const params = buildParams();
      if (moduleKey === 'initial') await reportsService.downloadFinancePdf(params);
      if (moduleKey === 'transport') await reportsService.downloadTransportPdf(params);
      if (moduleKey === 'investments') await reportsService.downloadInvestmentsPdf(params);
      toast('Download iniciado', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro ao baixar PDF', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Relatórios • {config.title}</h1>
          <p className="text-sm text-gray-600">Configure e gere relatórios modernos, com visual limpo e opções de impressão.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input-field" value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
          </select>
          <select className="input-field" value={orientation} onChange={(e) => setOrientation(e.target.value)}>
            <option value="portrait">Retrato</option>
            <option value="landscape">Paisagem</option>
          </select>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="mb-3">
          <label className="text-sm text-gray-600 mr-2">Período</label>
          <input type="date" className="input-field mr-2" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" className="input-field" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div className="mb-3">
          <label className="text-sm text-gray-600 mb-2 block">Variáveis</label>
          <div className="flex flex-wrap gap-2">
            {config.fields.map((field) => (
              <ToggleChip key={field.key} label={field.label} checked={selectedFields.includes(field.key)} onChange={() => toggleField(field.key)} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Ordenar por</label>
            <select className="input-field w-full" value={orderBy} onChange={(e) => setOrderBy(e.target.value)}>
              {config.orderBy.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Direção</label>
            <select className="input-field w-full" value={orderDir} onChange={(e) => setOrderDir(e.target.value)}>
              <option value="desc">Decrescente</option>
              <option value="asc">Crescente</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button className="btn btn-secondary" onClick={handlePreview} disabled={loading}>{loading ? 'Gerando...' : 'Preview'}</button>
            <button className="btn btn-primary" onClick={handleDownload} disabled={loading}>{loading ? 'Gerando...' : 'Download PDF'}</button>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-500">Dica: use o preview para validar filtros antes de baixar o relatório.</div>
      {previewUrl && (
        <div className="mt-6 border rounded overflow-hidden bg-white shadow-sm">
          <div className="flex items-center justify-between p-3 border-b bg-gray-50">
            <div className="text-sm text-gray-700">Preview do PDF</div>
            <div className="flex items-center gap-2">
              <a className="text-sm text-indigo-600 hover:underline" href={previewUrl} target="_blank" rel="noreferrer">Abrir em nova aba</a>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={() => { window.URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
              >
                Fechar
              </button>
            </div>
          </div>
          <div style={{ height: 600 }}>
            <iframe title="report-preview" src={previewUrl} className="w-full h-full" />
          </div>
        </div>
      )}
    </div>
  );
}

import api from './api';

const downloadPdf = async (url, filename, params = {}) => {
  const response = await api.get(url, { responseType: 'blob', params });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
};

const fetchPdfBlob = async (url, params = {}) => {
  const response = await api.get(url, { responseType: 'blob', params });
  return response.data;
};

export const reportsService = {
  downloadFinancePdf: async (params = {}) => downloadPdf('/reports/finance-pdf/', 'relatorio_financeiro.pdf', params),
  downloadTransportPdf: async (params = {}) => downloadPdf('/reports/transport-pdf/', 'relatorio_transportadora.pdf', params),
  downloadInvestmentsPdf: async (params = {}) => downloadPdf('/reports/investments-pdf/', 'relatorio_investimentos.pdf', params),
  fetchFinancePdf: async (params = {}) => fetchPdfBlob('/reports/finance-pdf/', params),
  fetchTransportPdf: async (params = {}) => fetchPdfBlob('/reports/transport-pdf/', params),
  fetchInvestmentsPdf: async (params = {}) => fetchPdfBlob('/reports/investments-pdf/', params),

  // Relatórios de Transportadora (retorno JSON para exibição em tela)
  fetchTransportReport: async (params = {}) => {
    const response = await api.get('/transport/reports/', { params });
    return response.data; // { rows, meta }
  },

  // Exportação PDF dos relatórios de Transportadora
  downloadTransportReportPdf: async (params = {}, filename) => {
    const reportType = params.report_type || 'relatorio';
    const resolvedFilename = filename || `relatorio_transporte_${reportType}.pdf`;
    // Chamar rota dedicada /transport/reports/pdf/ para evitar problemas de proxy
    return downloadPdf('/transport/reports/pdf/', resolvedFilename, { ...params });
  },

  // Exportação CSV dos relatórios de Transportadora
  downloadTransportReportCsv: async (params = {}, filename = 'relatorio_transporte.csv') => {
    const data = await api.get('/transport/reports/', { params });
    const { rows } = data.data;
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(';'),
      ...rows.map((row) =>
        headers.map((h) => {
          const val = row[h] ?? '';
          // Escapar aspas e envolver em aspas se contém ; ou quebra de linha
          const str = String(val).replace(/"/g, '""');
          return str.includes(';') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
        }).join(';')
      ),
    ];
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
  },
};

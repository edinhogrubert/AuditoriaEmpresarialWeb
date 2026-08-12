import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

// Lazy-initialize Gemini client to avoid crashes if API key is not present
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined in environment variables.');
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing
  app.use(express.json({ limit: '10mb' }));

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // AI Insights endpoint using the modern @google/genai SDK
  app.post('/api/ai/insights', async (req, res) => {
    const { batch, scanItems, expectedItems } = req.body;

    if (!batch) {
      return res.status(400).json({ error: 'Faltando dados do lote (batch).' });
    }

    const ai = getGeminiClient();

    // Fallback analytics in case Gemini API Key is missing or service fails
    const runFallbackAnalytics = () => {
      const totalExpected = expectedItems ? expectedItems.length : 0;
      const foundCount = expectedItems ? expectedItems.filter((e: any) => e.isFound).length : 0;
      const missingCount = totalExpected - foundCount;
      
      const expectedBarcodes = new Set(expectedItems ? expectedItems.map((e: any) => e.barcode.toLowerCase()) : []);
      const extraScans = scanItems ? scanItems.filter((s: any) => !expectedBarcodes.has(s.barcode.toLowerCase())) : [];
      const extraCount = new Set(extraScans.map((s: any) => s.barcode.toLowerCase())).size;

      const progressPercent = totalExpected > 0 ? Math.round((foundCount / totalExpected) * 100) : 0;
      
      let riskLevel = 'BAIXO';
      if (progressPercent < 50 && totalExpected > 0) {
        riskLevel = 'ALTO';
      } else if (progressPercent < 90 && totalExpected > 0) {
        riskLevel = 'MÉDIO';
      }

      // Basic rule-based anomaly detection
      const anomalies: any[] = [];
      if (missingCount > 0) {
        anomalies.push({
          type: 'Bens Ausentes (Ghost)',
          barcode: '-',
          description: `${missingCount} item(ns) esperado(s) não localizado(s)`,
          severity: 'CRÍTICO',
          message: 'Existem ativos previstos na lista de carga que não foram bipados pelo coletor físico. Há risco de extravio ou desalocação física.',
        });
      }
      if (extraCount > 0) {
        anomalies.push({
          type: 'Sobra de Estoque / Não Cadastrado (Orphan)',
          barcode: extraScans[0]?.barcode || '-',
          description: `${extraCount} patrimônio(s) excedente(s) localizado(s)`,
          severity: 'AVISO',
          message: 'Identificamos ativos físicos escaneados que não constavam no cadastro esperado. Possível erro de transferência interna ou falta de registro contábil.',
        });
      }

      // Check scan frequency for double scans
      const duplicateScans = scanItems ? scanItems.length - new Set(scanItems.map((s: any) => s.barcode)).size : 0;
      if (duplicateScans > 0) {
        anomalies.push({
          type: 'Leituras Duplicadas Bloqueadas',
          barcode: '-',
          description: `${duplicateScans} tentativa(s) de re-leitura`,
          severity: 'INFO',
          message: 'O coletor do aplicativo barrou com sucesso leituras subsequentes do mesmo ativo no mesmo lote de auditoria.',
        });
      }

      const recommendations = [
        'Realize a conciliação manual das sobras físicas verificando a plaqueta patrimonial original.',
        'Audite novamente os itens faltantes para assegurar que não foram guardados em setores trancados ou armários.',
        'Atualize o cadastro matriz de ativos com as transferências de departamento detectadas.',
        'Mantenha a frequência semanal de varreduras para minimizar passivos ocultos.'
      ];

      return {
        summary: `Relatório de Análise Local do lote "${batch.name}". O progresso geral da verificação física está em ${progressPercent}%, tendo reconciliado ${foundCount} de um total de ${totalExpected} ativos esperados. Registramos ${extraCount} sobras físicas e identificamos possíveis desvios de inventário que merecem atenção dos gestores de facilities.`,
        riskLevel,
        anomalies,
        recommendations,
        isFallback: true
      };
    };

    if (!ai) {
      console.info('Geração via IA usando motor analítico local estruturado (GEMINI_API_KEY ausente).');
      return res.json(runFallbackAnalytics());
    }

    try {
      const prompt = `Você é um Auditor e Analista de Ativos Patrimoniais Sênior.
Analise os dados deste lote de inventário/auditoria e gere um relatório estruturado de auditoria em JSON em PORTUGUÊS.

Lote:
Nome: ${batch.name}
Descrição: ${batch.description || 'Sem descrição'}
Tipo: ${batch.type}
Status: ${batch.isClosed ? 'Concluído/Encerrado' : 'Em andamento'}

Estatísticas Gerais fornecidas pelo sistema:
- Total Esperado no Cadastro: ${req.body.stats?.totalExpected || expectedItems?.length || 0}
- Total Localizado (OK): ${req.body.stats?.foundCount || 0}
- Total Ausente (Faltando): ${req.body.stats?.missingCount || 0}
- Total Sobras (Ativos lidos não cadastrados): ${req.body.stats?.extraCount || 0}

Itens Esperados de Inventário (amostra do cadastro original):
${JSON.stringify((expectedItems || []).slice(0, 40))}

Itens Efetivamente Coletados/Bipados pelo Operador de Campo:
${JSON.stringify((scanItems || []).slice(0, 80))}

Com base nisso, elabore uma análise minuciosa. Identifique:
1. Um resumo executivo maduro do lote de auditoria.
2. Defina o nível de risco de conformidade: 'BAIXO' (pouquíssimos desvios), 'MÉDIO' (algumas sobras ou faltas parciais), ou 'ALTO' (mais de 20% ausentes ou grandes sobras inexplicáveis).
3. Uma lista de anomalias concretas ou avisos (por exemplo, ativos faltantes de alto valor, sobras sem descrição que indicam risco de evasão fiscal ou obsolescência).
4. Uma lista de recomendações executivas e operacionais para a equipe de controle patrimonial.

Você DEVE retornar a resposta estritamente no formato de um objeto JSON válido que atenda às especificações abaixo, sem qualquer texto explicativo fora do JSON:
{
  "summary": "Um parágrafo de resumo executivo da auditoria do lote, destacando a qualidade física dos dados.",
  "riskLevel": "BAIXO" | "MÉDIO" | "ALTO",
  "anomalies": [
    {
      "type": "Nome sucinto do tipo de problema (ex: Sobras Físicas, Bens Ausentes Criticos, Duplicações Bloqueadas)",
      "barcode": "Código de barra de referência principal ou '-' se geral",
      "description": "Descrição breve do item ou categoria do erro",
      "severity": "CRÍTICO" | "AVISO" | "INFO",
      "message": "Mensagem analítica detalhada explicando o porquê do alerta e seu impacto operacional."
    }
  ],
  "recommendations": [
    "Recomendação prioritária 1...",
    "Recomendação prioritária 2..."
  ]
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      });

      const responseText = response.text || '';
      try {
        const parsedResult = JSON.parse(responseText.trim());
        return res.json({ ...parsedResult, isFallback: false });
      } catch (jsonErr) {
        console.error('Falha ao parsear JSON gerado pela IA:', responseText);
        // Fallback robusto se o JSON vier malformado
        return res.json(runFallbackAnalytics());
      }
    } catch (err: any) {
      console.error('Falha na requisição para o Gemini:', err);
      return res.json(runFallbackAnalytics());
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();


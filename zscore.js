// ============================================================================
// CALCULADORA DE Z-SCORE PEDIÁTRICO (PADRÃO OMS / CADERNETA DA CRIANÇA)
// Cálculo local instantâneo (0 a 60 meses) para Peso/Idade, Estatura/Idade,
// Perímetro Cefálico/Idade e IMC/Idade (Método LMS / Desvio Padrão OMS)
// ============================================================================

window.ZScoreCalculator = (function() {
  // Tabelas de referência simplificadas da OMS (0 a 60 meses) - Mediana (M) e DP (SD)
  // Valores em meses: [0, 1, 2, 3, 4, 5, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60]
  const MONTHS_GRID = [0, 1, 2, 3, 4, 5, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60];

  const WHO_DATA = {
    M: {
      // Peso (kg): [Mediana, DP aproximado]
      weight: [
        [3.35, 0.45], [4.47, 0.55], [5.56, 0.65], [6.37, 0.72], [7.00, 0.78],
        [7.51, 0.82], [7.93, 0.86], [8.90, 0.96], [9.65, 1.05], [10.3, 1.12],
        [10.9, 1.20], [12.2, 1.35], [13.3, 1.50], [14.3, 1.65], [16.3, 1.95], [18.3, 2.30]
      ],
      // Comprimento/Estatura (cm): [Mediana, DP]
      height: [
        [49.9, 1.89], [54.7, 1.95], [58.4, 2.00], [61.4, 2.05], [63.9, 2.10],
        [65.9, 2.15], [67.6, 2.20], [72.0, 2.30], [75.7, 2.42], [79.1, 2.55],
        [82.3, 2.68], [87.8, 2.95], [92.4, 3.20], [96.1, 3.45], [103.3, 3.90], [110.0, 4.35]
      ],
      // Perímetro Cefálico (cm): [Mediana, DP]
      hc: [
        [34.5, 1.26], [37.3, 1.22], [39.1, 1.22], [40.5, 1.23], [41.6, 1.24],
        [42.6, 1.25], [43.3, 1.26], [45.0, 1.28], [46.1, 1.29], [47.0, 1.31],
        [47.7, 1.32], [48.7, 1.35], [49.4, 1.37], [49.9, 1.39], [50.7, 1.42], [51.3, 1.44]
      ],
      // IMC (kg/m²): [Mediana, DP]
      bmi: [
        [13.4, 1.25], [14.9, 1.35], [16.3, 1.40], [16.9, 1.42], [17.2, 1.42],
        [17.3, 1.40], [17.3, 1.38], [17.2, 1.35], [16.8, 1.32], [16.4, 1.30],
        [16.1, 1.28], [15.7, 1.26], [15.5, 1.26], [15.4, 1.28], [15.3, 1.32], [15.2, 1.38]
      ]
    },
    F: {
      weight: [
        [3.23, 0.44], [4.18, 0.53], [5.12, 0.62], [5.84, 0.69], [6.42, 0.75],
        [6.89, 0.80], [7.29, 0.85], [8.22, 0.95], [8.95, 1.05], [9.60, 1.13],
        [10.2, 1.22], [11.5, 1.38], [12.7, 1.54], [13.9, 1.70], [16.1, 2.05], [18.2, 2.45]
      ],
      height: [
        [49.1, 1.86], [53.7, 1.92], [57.1, 1.98], [59.8, 2.04], [62.1, 2.09],
        [64.0, 2.14], [65.7, 2.19], [70.1, 2.31], [74.0, 2.45], [77.5, 2.59],
        [80.7, 2.72], [86.4, 3.00], [91.2, 3.26], [95.1, 3.50], [102.7, 3.98], [109.4, 4.42]
      ],
      hc: [
        [33.9, 1.22], [36.5, 1.20], [38.3, 1.21], [39.5, 1.22], [40.6, 1.23],
        [41.5, 1.24], [42.2, 1.25], [43.8, 1.27], [44.9, 1.28], [45.8, 1.30],
        [46.5, 1.31], [47.6, 1.34], [48.4, 1.36], [49.0, 1.38], [49.8, 1.40], [50.4, 1.42]
      ],
      bmi: [
        [13.3, 1.25], [14.6, 1.35], [15.8, 1.40], [16.4, 1.42], [16.7, 1.42],
        [16.8, 1.40], [16.9, 1.39], [16.8, 1.37], [16.4, 1.34], [16.0, 1.32],
        [15.7, 1.31], [15.4, 1.30], [15.3, 1.31], [15.2, 1.33], [15.2, 1.38], [15.3, 1.45]
      ]
    }
  };

  function interpolate(months, table) {
    const m = Math.max(0, Math.min(60, parseFloat(months) || 0));
    for (let i = 0; i < MONTHS_GRID.length - 1; i++) {
      const m0 = MONTHS_GRID[i];
      const m1 = MONTHS_GRID[i + 1];
      if (m >= m0 && m <= m1) {
        const ratio = m1 === m0 ? 0 : (m - m0) / (m1 - m0);
        const med = table[i][0] + ratio * (table[i + 1][0] - table[i][0]);
        const sd = table[i][1] + ratio * (table[i + 1][1] - table[i][1]);
        return { med, sd };
      }
    }
    const last = table[table.length - 1];
    return { med: last[0], sd: last[1] };
  }

  function formatZ(z) {
    const sign = z >= 0 ? '+' : '';
    return `${sign}${z.toFixed(2)} DP`;
  }

  function classifyWeightForAge(z) {
    if (z < -3) return 'Muito baixo peso para a idade (Z < -3)';
    if (z < -2) return 'Baixo peso para a idade (-3 ≤ Z < -2)';
    if (z <= 2) return 'Peso adequado para a idade (-2 ≤ Z ≤ +2)';
    return 'Peso elevado para a idade (Z > +2)';
  }

  function classifyHeightForAge(z) {
    if (z < -3) return 'Muito baixa estatura para a idade (Z < -3)';
    if (z < -2) return 'Baixa estatura para a idade (-3 ≤ Z < -2)';
    return 'Estatura adequada para a idade (Z ≥ -2)';
  }

  function classifyHCForAge(z) {
    if (z < -2) return 'Acima do risco p/ Microcefalia (Z < -2)';
    if (z <= 2) return 'Perímetro cefálico adequado (-2 ≤ Z ≤ +2)';
    return 'Risco p/ Macrocefalia (Z > +2)';
  }

  function classifyBMIForAge(z, months) {
    if (z < -3) return 'Magreza acentuada (Z < -3)';
    if (z < -2) return 'Magreza (-3 ≤ Z < -2)';
    if (z <= 1) return 'Eutrofia (-2 ≤ Z ≤ +1)';
    if (months <= 60) {
      if (z <= 2) return 'Risco de sobrepeso (+1 < Z ≤ +2)';
      if (z <= 3) return 'Sobrepeso (+2 < Z ≤ +3)';
      return 'Obesidade (Z > +3)';
    } else {
      if (z <= 2) return 'Sobrepeso (+1 < Z ≤ +2)';
      return 'Obesidade (Z > +2)';
    }
  }

  function calculate({ sex = 'M', months = 6, weightKg = null, heightCm = null, hcCm = null }) {
    const ref = WHO_DATA[sex === 'F' ? 'F' : 'M'];
    const m = parseFloat(months);
    if (isNaN(m) || m < 0) return null;

    // Se o médico digitou o peso em gramas (ex: 7500), converte automaticamente para kg (7.5)
    let w = parseFloat(weightKg);
    if (!isNaN(w) && w > 80) {
      w = w / 1000;
    }
    const h = parseFloat(heightCm);
    const hc = parseFloat(hcCm);

    const result = {
      months: m,
      sex: sex === 'F' ? 'Feminino' : 'Masculino',
      weight: null,
      height: null,
      hc: null,
      bmi: null,
      summaryText: ''
    };

    const lines = [];

    if (!isNaN(w) && w > 0) {
      const { med, sd } = interpolate(m, ref.weight);
      const z = (w - med) / sd;
      result.weight = {
        valueKg: w,
        valueGrams: Math.round(w * 1000),
        z,
        zFormatted: formatZ(z),
        classification: classifyWeightForAge(z)
      };
      lines.push(`Peso: ${w.toFixed(3).replace(/\.?0+$/, '')} kg (${Math.round(w * 1000)} g) | Z-Score Peso/Idade: ${formatZ(z)} (${result.weight.classification})`);
    }

    if (!isNaN(h) && h > 0) {
      const { med, sd } = interpolate(m, ref.height);
      const z = (h - med) / sd;
      result.height = {
        valueCm: h,
        z,
        zFormatted: formatZ(z),
        classification: classifyHeightForAge(z)
      };
      lines.push(`Altura/Comprimento: ${h} cm | Z-Score Estatura/Idade: ${formatZ(z)} (${result.height.classification})`);
    }

    if (!isNaN(hc) && hc > 0) {
      const { med, sd } = interpolate(m, ref.hc);
      const z = (hc - med) / sd;
      result.hc = {
        valueCm: hc,
        z,
        zFormatted: formatZ(z),
        classification: classifyHCForAge(z)
      };
      lines.push(`PC: ${hc} cm | Z-Score PC/Idade: ${formatZ(z)} (${result.hc.classification})`);
    }

    if (!isNaN(w) && w > 0 && !isNaN(h) && h > 0) {
      const hMeters = h / 100;
      const bmiVal = w / (hMeters * hMeters);
      const { med, sd } = interpolate(m, ref.bmi);
      const z = (bmiVal - med) / sd;
      result.bmi = {
        value: bmiVal.toFixed(1),
        z,
        zFormatted: formatZ(z),
        classification: classifyBMIForAge(z, m)
      };
      lines.push(`IMC: ${bmiVal.toFixed(1)} kg/m² | Z-Score IMC/Idade: ${formatZ(z)} (${result.bmi.classification})`);
    }

    result.summaryText = lines.join('\n');
    return result;
  }

  return { calculate };
})();

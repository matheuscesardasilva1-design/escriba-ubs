// ============================================================================
// CALCULADORA DE Z-SCORE PEDIÁTRICO (PADRÃO OMS / CADERNETA DA CRIANÇA)
// Com suporte a Prematuridade (Idade Corrigida para IG < 37 semanas) e
// trava de segurança: só calcula quando Idade + Medidas forem informadas!
// ============================================================================

window.ZScoreCalculator = (function() {
  // Tabelas de referência da OMS (0 a 60 meses) - Mediana (M) e DP (SD)
  const MONTHS_GRID = [0, 1, 2, 3, 4, 5, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60];

  const WHO_DATA = {
    M: {
      weight: [
        [3.35, 0.45], [4.47, 0.55], [5.56, 0.65], [6.37, 0.72], [7.00, 0.78],
        [7.51, 0.82], [7.93, 0.86], [8.90, 0.96], [9.65, 1.05], [10.3, 1.12],
        [10.9, 1.20], [12.2, 1.35], [13.3, 1.50], [14.3, 1.65], [16.3, 1.95], [18.3, 2.30]
      ],
      height: [
        [49.9, 1.89], [54.7, 1.95], [58.4, 2.00], [61.4, 2.05], [63.9, 2.10],
        [65.9, 2.15], [67.6, 2.20], [72.0, 2.30], [75.7, 2.42], [79.1, 2.55],
        [82.3, 2.68], [87.8, 2.95], [92.4, 3.20], [96.1, 3.45], [103.3, 3.90], [110.0, 4.35]
      ],
      hc: [
        [34.5, 1.26], [37.3, 1.22], [39.1, 1.22], [40.5, 1.23], [41.6, 1.24],
        [42.6, 1.25], [43.3, 1.26], [45.0, 1.28], [46.1, 1.29], [47.0, 1.31],
        [47.7, 1.32], [48.7, 1.35], [49.4, 1.37], [49.9, 1.39], [50.7, 1.42], [51.3, 1.44]
      ],
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
    if (z < -2) return 'Abaixo do esperado / Risco p/ Microcefalia (Z < -2)';
    if (z <= 2) return 'Perímetro cefálico adequado (-2 ≤ Z ≤ +2)';
    return 'Acima do esperado / Risco p/ Macrocefalia (Z > +2)';
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

  function parseBirthGAWeeks(raw) {
    if (raw === null || raw === undefined) return NaN;
    const s = String(raw).trim().replace(',', '.');
    if (!s) return NaN;
    const plusMatch = s.match(/^(\d+(?:\.\d+)?)\s*\+\s*(\d+)$/);
    if (plusMatch) {
      const w = parseFloat(plusMatch[1]);
      const d = parseInt(plusMatch[2], 10);
      if (!isNaN(w) && !isNaN(d) && d >= 0 && d <= 6) {
        return w + (d / 7);
      }
    }
    return parseFloat(s);
  }

  function formatAgePT(totalMonths) {
    const m = Math.max(0, Number(totalMonths) || 0);
    const rounded = Math.round(m * 10) / 10;
    const yrs = Math.floor(rounded / 12);
    const remM = Math.round((rounded - yrs * 12) * 10) / 10;
    const remStr = Number.isInteger(remM) ? String(remM) : remM.toFixed(1).replace('.', ',');
    if (yrs > 0 && remM > 0) {
      return `${yrs} ${yrs === 1 ? 'ano' : 'anos'} e ${remStr} ${remM === 1 ? 'mês' : 'meses'}`;
    }
    if (yrs > 0) {
      return `${yrs} ${yrs === 1 ? 'ano' : 'anos'}`;
    }
    return `${remStr} ${rounded === 1 ? 'mês' : 'meses'}`;
  }

  function computeAgeInfo({ years = null, months = null, birthGAWeeks = null }) {
    const hasY = years !== null && years !== undefined && String(years).trim() !== '';
    const hasM = months !== null && months !== undefined && String(months).trim() !== '';
    if (!hasY && !hasM) return null;
    const yNum = hasY ? parseFloat(String(years).replace(',', '.').trim()) : 0;
    const mNum = hasM ? parseFloat(String(months).replace(',', '.').trim()) : 0;
    if (isNaN(yNum) || isNaN(mNum) || yNum < 0 || mNum < 0) return null;
    const chronologicalMonths = (yNum * 12) + mNum;
    const ga = parseBirthGAWeeks(birthGAWeeks);
    const gaRaw = birthGAWeeks !== null && birthGAWeeks !== undefined ? String(birthGAWeeks).trim() : '';
    const isPremature = !isNaN(ga) && ga > 20 && ga < 37;
    let correctedMonths = chronologicalMonths;
    let needsCorrection = false;
    let isPretermIntergrowth = false;
    if (isPremature && chronologicalMonths <= 24) {
      needsCorrection = true;
      const weeksPremature = 40 - ga;
      const monthsDiscount = (weeksPremature * 7) / 30.4375;
      correctedMonths = chronologicalMonths - monthsDiscount;
      if (correctedMonths < 0) {
        isPretermIntergrowth = true;
      }
    }
    return {
      chronologicalMonths,
      chronologicalLabel: formatAgePT(chronologicalMonths),
      gaWeeks: ga,
      gaRaw: gaRaw || (!isNaN(ga) ? String(ga) : ''),
      isPremature,
      needsCorrection,
      isPretermIntergrowth,
      correctedMonths: Math.max(0, correctedMonths),
      rawCorrectedMonths: correctedMonths,
      correctedLabel: isPretermIntergrowth ? 'Abaixo de 40 sem (Intergrowth-21st)' : formatAgePT(correctedMonths)
    };
  }

  function calculate({ sex = 'M', years = null, months = null, birthGAWeeks = null, weightKg = null, heightCm = null, hcCm = null }) {
    const ageInfo = computeAgeInfo({ years, months, birthGAWeeks });
    if (!ageInfo) return null;

    const toNum = (v) => (v === null || v === undefined || String(v).trim() === '') ? NaN : parseFloat(String(v).replace(',', '.').trim());
    const mChronological = ageInfo.chronologicalMonths;
    const ga = ageInfo.gaWeeks;
    let mEffective = mChronological;
    let prematurityNote = '';

    // Se nasceu prematuro (IG < 37 semanas) e tem até 24 meses, corrige a idade para 40 semanas (padrão OMS)!
    if (ageInfo.needsCorrection) {
      if (ageInfo.isPretermIntergrowth) {
        return {
          months: mChronological,
          correctedMonths: ageInfo.rawCorrectedMonths,
          ageInfo,
          isPretermIntergrowth: true,
          summaryText: `Prematuro (IG ao nascer: ${ageInfo.gaRaw} sem | Idade cronológica: ${ageInfo.chronologicalLabel}) — Ainda abaixo de 40 semanas de Idade Pós-Menstrual (avaliar pela curva Intergrowth-21st; não aplicar Z-Score OMS de termo).`
        };
      }
      mEffective = ageInfo.correctedMonths;
      prematurityNote = ` [ Z-Score OMS pela Idade Corrigida: ${ageInfo.correctedLabel} (Prematuro de ${ageInfo.gaRaw} sem) ]`;
    }

    const ref = WHO_DATA[sex === 'F' ? 'F' : 'M'];

    let w = toNum(weightKg);
    if (!isNaN(w) && w > 80) {
      w = w / 1000;
    }
    const h = toNum(heightCm);
    const hc = toNum(hcCm);

    const result = {
      months: mChronological,
      correctedMonths: mEffective,
      ageInfo,
      sex: sex === 'F' ? 'Feminino' : 'Masculino',
      weight: null,
      height: null,
      hc: null,
      bmi: null,
      summaryText: ''
    };

    const lines = [];
    if (ageInfo.needsCorrection) {
      lines.push(`Idade Cronológica: ${ageInfo.chronologicalLabel} | Idade Corrigida OMS (Prematuro ${ageInfo.gaRaw} sem): ${ageInfo.correctedLabel}`);
    }

    if (!isNaN(w) && w > 0) {
      const { med, sd } = interpolate(mEffective, ref.weight);
      const z = (w - med) / sd;
      result.weight = {
        valueKg: w,
        valueGrams: Math.round(w * 1000),
        z,
        zFormatted: formatZ(z),
        classification: classifyWeightForAge(z)
      };
      lines.push(`Peso: ${w.toFixed(3).replace(/\.?0+$/, '')} kg (${Math.round(w * 1000)} g) — Z-Score Peso/Idade: ${formatZ(z)} (${result.weight.classification})${prematurityNote}`);
    }

    if (!isNaN(h) && h > 0) {
      const { med, sd } = interpolate(mEffective, ref.height);
      const z = (h - med) / sd;
      result.height = {
        valueCm: h,
        z,
        zFormatted: formatZ(z),
        classification: classifyHeightForAge(z)
      };
      lines.push(`Altura/Comprimento: ${h} cm — Z-Score Estatura/Idade: ${formatZ(z)} (${result.height.classification})${prematurityNote}`);
    }

    if (!isNaN(hc) && hc > 0) {
      const { med, sd } = interpolate(mEffective, ref.hc);
      const z = (hc - med) / sd;
      result.hc = {
        valueCm: hc,
        z,
        zFormatted: formatZ(z),
        classification: classifyHCForAge(z)
      };
      lines.push(`PC: ${hc} cm — Z-Score PC/Idade: ${formatZ(z)} (${result.hc.classification})${prematurityNote}`);
    }

    if (!isNaN(w) && w > 0 && !isNaN(h) && h > 0) {
      const hMeters = h / 100;
      const bmiVal = w / (hMeters * hMeters);
      const { med, sd } = interpolate(mEffective, ref.bmi);
      const z = (bmiVal - med) / sd;
      result.bmi = {
        value: bmiVal.toFixed(1),
        z,
        zFormatted: formatZ(z),
        classification: classifyBMIForAge(z, mEffective)
      };
      lines.push(`IMC: ${bmiVal.toFixed(1)} kg/m² — Z-Score IMC/Idade: ${formatZ(z)} (${result.bmi.classification})${prematurityNote}`);
    }

    result.summaryText = lines.join('\n');
    return result;
  }

  return { calculate, computeAgeInfo, formatAgePT, parseBirthGAWeeks };
})();

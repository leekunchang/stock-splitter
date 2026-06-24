import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, Plus, Trash2, PieChart, Sparkles, RefreshCw, ArrowRightLeft, Coins, DollarSign, TrendingUp, Download } from 'lucide-react';
import { RatioPart, CalculationResult, AiSuggestion } from './types';
import { getBudgetingAdvice, getLiveExchangeRate, fetchFallbackExchangeRate } from './services/geminiService';

const App: React.FC = () => {
  const [totalAmount, setTotalAmount] = useState<number | "">(10000000);
  const [ratioParts, setRatioParts] = useState<RatioPart[]>([
    { id: '1', value: 6, label: '항목 A' },
    { id: '2', value: 4, label: '항목 B' }
  ]);
  const [aiAdvice, setAiAdvice] = useState<AiSuggestion | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [purposeInput, setPurposeInput] = useState('');

  // Exchange rate states
  const [exchangeRate, setExchangeRate] = useState<number>(1380.0);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [exchangeRateInput, setExchangeRateInput] = useState<string>('1380.0');
  const [inputCurrency, setInputCurrency] = useState<'KRW' | 'USD'>('KRW');
  const [isFetchingExchangeRate, setIsFetchingExchangeRate] = useState(false);
  const [exchangeRateProvider, setExchangeRateProvider] = useState<'gemini' | 'api' | 'manual' | 'default'>('default');
  const [exchangeRateTime, setExchangeRateTime] = useState<string | null>(null);

  // Rebalancing simulation states
  const [simulatedPartId, setSimulatedPartId] = useState<string | null>(null);
  const [simulatedAmount, setSimulatedAmount] = useState<number | "" | null>(null);
  const [simulatedCurrency, setSimulatedCurrency] = useState<'KRW' | 'USD'>('KRW');

  // Fetch live exchange rate using Google Search grounding or Rest API backup
  const updateExchangeRateFn = async () => {
    setIsFetchingExchangeRate(true);
    try {
      // 1. Try Gemini with Google Search grounding first
      const rate = await getLiveExchangeRate();
      if (rate && rate > 500 && rate < 3000) {
        setExchangeRate(rate);
        setExchangeRateInput(rate.toString());
        setExchangeRateProvider('gemini');
        setExchangeRateTime(new Date().toLocaleTimeString('ko-KR'));
        setIsFetchingExchangeRate(false);
        return;
      }
    } catch (e) {
      console.warn("Gemini Google Search exchange rate failed, trying direct API.", e);
    }

    try {
      // 2. Try public REST API as fallback
      const rate = await fetchFallbackExchangeRate();
      if (rate && rate > 500 && rate < 3000) {
        setExchangeRate(rate);
        setExchangeRateInput(rate.toString());
        setExchangeRateProvider('api');
        setExchangeRateTime(new Date().toLocaleTimeString('ko-KR'));
        setIsFetchingExchangeRate(false);
        return;
      }
    } catch (e) {
      console.error("Direct exchange rate API also failed.", e);
    }

    setIsFetchingExchangeRate(false);
  };

  // Fetch exchange rate on mount
  useEffect(() => {
    updateExchangeRateFn();
  }, []);

  const handleSaveManualRate = () => {
    const val = parseFloat(exchangeRateInput);
    if (!isNaN(val) && val > 0) {
      setExchangeRate(val);
      setExchangeRateProvider('manual');
      setExchangeRateTime(new Date().toLocaleTimeString('ko-KR'));
      setIsEditingRate(false);
    }
  };

  const results = useMemo((): CalculationResult[] => {
    const totalRatio = ratioParts.reduce((sum, part) => {
      const val = part.value === "" ? 0 : part.value;
      return sum + val;
    }, 0);
    if (totalRatio === 0) return [];

    const amt = totalAmount === "" ? 0 : totalAmount;
    const totalAmountKrw = inputCurrency === 'KRW' ? amt : amt * exchangeRate;
    const totalAmountUsd = inputCurrency === 'USD' ? amt : amt / exchangeRate;

    return ratioParts.map(part => {
      const partRatio = part.value === "" ? 0 : part.value;
      return {
        id: part.id,
        label: part.label,
        ratio: partRatio,
        percentage: (partRatio / totalRatio) * 100,
        amountKrw: Math.round((partRatio / totalRatio) * totalAmountKrw),
        amountUsd: Math.round((partRatio / totalRatio) * totalAmountUsd * 100) / 100
      };
    });
  }, [totalAmount, ratioParts, inputCurrency, exchangeRate]);

  // Compute simulated results for rebalancing
  const simulatedValues = useMemo(() => {
    if (simulatedPartId === null || simulatedAmount === null || simulatedAmount === "" || simulatedAmount <= 0) {
      return null;
    }

    const targetPart = ratioParts.find(p => p.id === simulatedPartId);
    if (!targetPart) return null;
    const targetPartValue = targetPart.value === "" ? 0 : targetPart.value;
    if (targetPartValue <= 0) return null;

    const baseAmount = simulatedAmount / targetPartValue;

    return ratioParts.reduce((acc, part) => {
      const partRatio = part.value === "" ? 0 : part.value;
      const val = baseAmount * partRatio;
      
      let krw = 0;
      let usd = 0;
      if (simulatedCurrency === 'KRW') {
        krw = Math.round(val);
        usd = Math.round((val / exchangeRate) * 100) / 100;
      } else {
        usd = Math.round(val * 100) / 100;
        krw = Math.round(val * exchangeRate);
      }

      acc[part.id] = { krw, usd };
      return acc;
    }, {} as { [key: string]: { krw: number; usd: number } });
  }, [simulatedPartId, simulatedAmount, simulatedCurrency, ratioParts, exchangeRate]);

  const addPart = () => {
    const nextId = `part-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setRatioParts([...ratioParts, { id: nextId, value: 1, label: `항목 ${String.fromCharCode(65 + ratioParts.length)}` }]);
  };

  const removePart = (id: string) => {
    if (ratioParts.length <= 1) return;
    setRatioParts(ratioParts.filter(p => p.id !== id));
    if (simulatedPartId === id) {
      setSimulatedPartId(null);
      setSimulatedAmount(null);
    }
  };

  const updatePart = (id: string, updates: Partial<RatioPart>) => {
    setRatioParts(ratioParts.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const formatKRW = (val: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(val);
  };

  const formatUSD = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const handleAiAsk = async () => {
    if (!purposeInput.trim()) return;
    setIsLoadingAi(true);
    const advice = await getBudgetingAdvice(purposeInput);
    if (advice) {
      setAiAdvice(advice);
    }
    setIsLoadingAi(false);
  };

  const applyAiAdvice = () => {
    if (!aiAdvice) return;
    const newParts = aiAdvice.ratios.map((val, idx) => ({
      id: `part-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`,
      value: val,
      label: aiAdvice.labels[idx] || `항목 ${idx + 1}`
    }));
    setRatioParts(newParts);
    setSimulatedPartId(null);
    setSimulatedAmount(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <header className="max-w-5xl mx-auto mb-8 text-center" id="main-header">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2" id="main-title">자동 금액 분배 계산기</h1>
        <p className="text-slate-500 max-w-lg mx-auto text-sm md:text-base" id="main-description">
          총액과 비율만 입력하세요.
        </p>
      </header>

      <main className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8" id="calculator-workspace">
        {/* Left Column: Input Panel */}
        <section className="lg:col-span-12 xl:col-span-5 lg:order-1 space-y-6" id="input-panel">
          
          {/* Total Amount & Currency Selection Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6" id="amount-config-card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm">1</span>
                총액 설정
              </h2>
              <div className="flex bg-slate-100 rounded-lg p-1" id="currency-toggle">
                <button
                  type="button"
                  onClick={() => {
                    if (inputCurrency === 'USD') {
                      setTotalAmount(totalAmount === "" ? "" : Math.round(totalAmount * exchangeRate));
                    }
                    setInputCurrency('KRW');
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    inputCurrency === 'KRW'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  KRW (₩)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (inputCurrency === 'KRW') {
                      setTotalAmount(totalAmount === "" ? "" : Math.round((totalAmount / exchangeRate) * 100) / 100);
                    }
                    setInputCurrency('USD');
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    inputCurrency === 'USD'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  USD ($)
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="number"
                value={totalAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  setTotalAmount(val === "" ? "" : Number(val));
                }}
                className="w-full pl-4 pr-16 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-xl font-bold transition-all text-slate-800"
                placeholder={inputCurrency === 'KRW' ? '총 원화 금액을 입력하세요' : '총 달러 금액을 입력하세요'}
                id="total-amount-input"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                {inputCurrency === 'KRW' ? '원' : 'USD'}
              </span>
            </div>

            <div className="mt-3 flex justify-between text-xs text-slate-500 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100" id="currency-convert-display">
              <span className="flex items-center gap-1.5">
                {inputCurrency === 'KRW' ? <Coins size={14} className="text-amber-500" /> : <DollarSign size={14} className="text-emerald-500" />}
                입력액: <strong className="text-slate-800 font-semibold">{inputCurrency === 'KRW' ? formatKRW(totalAmount) : formatUSD(totalAmount)}</strong>
              </span>
              <span className="text-slate-400">≈</span>
              <span className="text-blue-600 font-bold">
                실시간 환산: {inputCurrency === 'KRW' ? formatUSD(totalAmount / exchangeRate) : formatKRW(totalAmount * exchangeRate)}
              </span>
            </div>
          </div>

          {/* Exchange Rate Setup Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 relative overflow-hidden" id="exchange-rate-card">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-50 to-transparent -z-10 rounded-full" />
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-blue-500" />
                  실시간 환율 변환 정보
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">구글 검색을 적용한 실시간 환율을 반영합니다.</p>
              </div>
              <button
                type="button"
                onClick={updateExchangeRateFn}
                disabled={isFetchingExchangeRate}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-50"
                title="Google 실시간 환율 업데이트"
                id="refresh-rate-btn"
              >
                <RefreshCw size={16} className={isFetchingExchangeRate ? "animate-spin text-blue-500" : ""} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between" id="exchange-rate-value-display">
              {isEditingRate ? (
                <div className="flex gap-2 items-center w-full" id="manual-rate-editor">
                  <span className="text-xs font-bold text-slate-500">1 USD =</span>
                  <input
                    type="number"
                    value={exchangeRateInput}
                    onChange={(e) => setExchangeRateInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-right focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                    placeholder="환율 입력"
                    step="0.1"
                  />
                  <span className="text-xs font-bold text-slate-500">원</span>
                  <button
                    type="button"
                    onClick={handleSaveManualRate}
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    적용
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingRate(false);
                      setExchangeRateInput(exchangeRate.toString());
                    }}
                    className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs font-medium"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center w-full" id="rate-static-item">
                  <div>
                    <div className="text-xl font-black text-slate-800 tracking-tight">
                      1 USD <span className="text-slate-400 font-medium">≈</span> ₩{exchangeRate.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        exchangeRateProvider === 'gemini' ? 'bg-green-500' :
                        exchangeRateProvider === 'api' ? 'bg-amber-500' :
                        exchangeRateProvider === 'manual' ? 'bg-blue-500' : 'bg-slate-400'
                      }`} />
                      <span className="text-[10px] text-slate-500 font-bold uppercase">
                        {exchangeRateProvider === 'gemini' ? '구글 실시간 검색 연동' :
                         exchangeRateProvider === 'api' ? '금융 정보 REST API 연동' :
                         exchangeRateProvider === 'manual' ? '수동 입력값 사용중' : '기본 설정값'}
                      </span>
                      {exchangeRateTime && (
                        <span className="text-[10px] text-slate-400">({exchangeRateTime})</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingRate(true);
                      setExchangeRateInput(exchangeRate.toString());
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    id="edit-rate-btn"
                  >
                    수동 변경
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1">
              <span>💡</span>
              <span>달러-원 비율 계산에 실시간 환율이 자동 적용됩니다. 환율 수치 수정도 가능합니다.</span>
            </div>
          </div>

          {/* Ratio Config Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6" id="ratio-config-card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm">2</span>
                비율 설정
              </h2>
              <button 
                type="button"
                onClick={addPart}
                className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                id="add-part-btn"
              >
                <Plus size={16} />
                항목 추가
              </button>
            </div>
            
            <div className="space-y-3" id="parts-container">
              {ratioParts.map((part) => (
                <div key={part.id} className="flex gap-1.5 items-center group">
                  <input
                    type="text"
                    value={part.label}
                    onChange={(e) => updatePart(part.id, { label: e.target.value })}
                    className="flex-1 min-w-[80px] px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs md:text-sm font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-700"
                    placeholder="항목명"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      value={part.value}
                      onChange={(e) => {
                        const val = e.target.value;
                        updatePart(part.id, { value: val === "" ? "" : Number(val) });
                      }}
                      className="w-14 md:w-16 px-1 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs md:text-sm font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none text-center text-slate-800"
                      placeholder="비율"
                    />
                    <button 
                      type="button"
                      onClick={() => removePart(part.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all rounded-lg shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-dashed border-slate-100">
              <div className="flex justify-between items-center text-sm font-semibold">
                <span className="text-slate-500 uppercase tracking-wider">전체 비율 합계</span>
                <span className="text-blue-600 px-3 py-1 bg-blue-50 rounded-full font-bold">
                  {ratioParts.reduce((s, p) => s + (p.value === "" ? 0 : p.value), 0)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Results Panel */}
        <section className="lg:col-span-12 xl:col-span-7 space-y-6 lg:order-2" id="results-panel">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col h-auto" id="results-card">
            <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center" id="results-header">
              <div>
                <h2 className="text-xl font-bold text-slate-800">계산 결과</h2>
                <p className="text-slate-400 text-sm">입력하신 비율과 실시간 환율을 반영한 금액 배분 테이블입니다.</p>
              </div>
              <PieChart className="text-blue-300" size={40} />
            </div>

            {results.length > 0 && (
              <div className="mx-6 md:mx-8 mt-4 p-3.5 bg-blue-50/60 rounded-xl border border-blue-100/70 text-xs text-blue-800 flex items-start gap-2.5" id="rebalancing-info-bar">
                <span className="text-base">🔄</span>
                <div>
                  <strong className="font-extrabold block mb-0.5">실시간 리밸런싱 모의 계산기 활성화</strong>
                  <span className="text-slate-600 leading-relaxed font-medium">
                    아래 각 항목의 <strong>"모의 입력"</strong> 창에 특정 타겟 금액을 입력해보세요. 설정한 비율에 맞춰 다른 모든 항목의 목표 투자 금액이 실시간으로 연동되어 자동 채워집니다.
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1 p-6 md:p-8 space-y-4 overflow-y-auto max-h-[600px]" id="results-list">
              {results.length > 0 ? (
                results.map((res, idx) => {
                  const isThisSource = simulatedPartId === res.id;
                  const isSimulationActive = simulatedPartId !== null;
                  
                  // Compute simulated display amount for this item
                  const simValObj = simulatedValues ? simulatedValues[res.id] : null;
                  const simDisplayVal = simValObj 
                    ? (simulatedCurrency === 'KRW' ? simValObj.krw : simValObj.usd)
                    : null;

                  return (
                    <div 
                      key={idx} 
                      className={`group relative bg-white border rounded-2xl p-4 md:p-5 hover:shadow-md transition-all ${
                        isThisSource 
                          ? 'border-blue-400 bg-blue-50/10 ring-2 ring-blue-100' 
                          : isSimulationActive 
                            ? 'border-green-200 bg-green-50/5' 
                            : 'border-slate-100'
                      }`} 
                      id={`result-item-${idx}`}
                    >
                      <div className="flex flex-row items-center justify-between gap-3 md:gap-4">
                        <div className="flex items-center gap-2 md:gap-4">
                          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-sm md:text-lg font-bold
                            ${idx % 3 === 0 ? 'bg-blue-100 text-blue-600' : 
                              idx % 3 === 1 ? 'bg-indigo-100 text-indigo-600' : 
                              'bg-violet-100 text-violet-600'}`}>
                            {res.ratio}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="font-bold text-slate-700 text-sm md:text-base leading-tight">{res.label}</h3>
                              {isThisSource && (
                                <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[9px] font-extrabold tracking-wide whitespace-nowrap">
                                  모의 기준
                                </span>
                              )}
                              {!isThisSource && isSimulationActive && (
                                <span className="px-1.5 py-0.5 bg-green-600 text-white rounded text-[9px] font-extrabold tracking-wide whitespace-nowrap">
                                  비율 계산
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] md:text-xs text-slate-400 font-medium tracking-wide">
                              전체의 {res.percentage.toFixed(1)}% 차지
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base md:text-2xl font-black text-slate-800 tabular-nums leading-snug">
                            {formatKRW(res.amountKrw)}
                          </div>
                          <div className="text-xs md:text-sm font-extrabold text-blue-600 tabular-nums">
                            {formatUSD(res.amountUsd)}
                          </div>
                          <div className="text-[9px] md:text-[10px] text-slate-400 font-bold mt-0.5">기본 배분액</div>
                        </div>
                      </div>
                      
                      {/* Visual Progress Bar */}
                      <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-700 ease-out
                            ${idx % 3 === 0 ? 'bg-blue-500' : 
                              idx % 3 === 1 ? 'bg-indigo-500' : 
                              'bg-violet-500'}`}
                          style={{ width: `${res.percentage}%` }}
                        />
                      </div>

                      {/* Rebalancing Simulation Area */}
                      <div className={`mt-4 pt-3.5 border-t border-dashed ${
                        isThisSource ? 'border-blue-300 bg-blue-50/30' : 'border-slate-100'
                      } -mx-2 px-2 rounded-xl transition-all`}>
                        <div className="flex flex-row items-center justify-between gap-2">
                          <div className="flex items-center gap-1 text-[11px] md:text-xs font-bold text-slate-500 min-w-0">
                            <ArrowRightLeft size={12} className={`shrink-0 ${isThisSource ? "text-blue-600 animate-pulse" : "text-slate-400"}`} />
                            <span className="truncate">{res.label} 모의</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className={`flex items-center border rounded-lg bg-white shadow-xs overflow-hidden transition-all ${
                              isThisSource 
                                ? 'border-blue-500 ring-2 ring-blue-100' 
                                : isSimulationActive 
                                  ? 'border-green-300 bg-green-50/10' 
                                  : 'border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100'
                            }`}>
                              <input
                                type="number"
                                placeholder={isThisSource ? "금액 입력" : isSimulationActive ? "" : "금액 입력"}
                                value={
                                  isThisSource 
                                    ? (simulatedAmount !== null ? simulatedAmount : '') 
                                    : (simDisplayVal !== null ? simDisplayVal : '')
                                }
                                onChange={(e) => {
                                  const valStr = e.target.value;
                                  if (valStr === '') {
                                    setSimulatedPartId(null);
                                    setSimulatedAmount(null);
                                  } else {
                                    const val = valStr === "" ? "" : Number(valStr);
                                    setSimulatedPartId(res.id);
                                    setSimulatedAmount(val);
                                    setSimulatedCurrency(inputCurrency);
                                  }
                                }}
                                className="w-24 xs:w-28 pl-2.5 pr-1 py-1.5 text-xs focus:outline-none font-bold text-left text-slate-800 bg-transparent min-w-0"
                              />
                              <span className="bg-slate-50 border-l border-slate-100 px-2 py-1.5 text-[10px] font-extrabold text-slate-500 select-none min-w-[40px] text-center">
                                {inputCurrency}
                              </span>
                            </div>
                            {isSimulationActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSimulatedPartId(null);
                                  setSimulatedAmount(null);
                                }}
                                className="text-[10px] text-red-500 hover:text-red-600 font-bold hover:underline"
                              >
                                초기화
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Exchange Equivalent */}
                        {simValObj && (
                          <div className="mt-2 flex justify-between items-center text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100/50">
                            <span className="text-slate-400 font-semibold">반대 통화 환산:</span>
                            <span className="font-extrabold text-slate-700">
                              {simulatedCurrency === 'KRW' 
                                ? formatUSD(simValObj.usd) 
                                : formatKRW(simValObj.krw)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400" id="empty-state">
                  <Calculator size={48} className="mb-4 opacity-20" />
                  <p>항목과 비율을 입력하면 결과가 나타납니다.</p>
                </div>
              )}
            </div>

            <div className="p-6 md:p-8 bg-blue-600 text-white mt-auto" id="results-footer-summary">
              <div className="flex justify-between items-start">
                <span className="text-blue-100 font-bold mt-1 uppercase text-sm tracking-wider">총 합계</span>
                <div className="text-right">
                  <div className="text-2xl md:text-3xl font-black tracking-tight leading-none tabular-nums">
                    {formatKRW(results.reduce((s, r) => s + r.amountKrw, 0))}
                  </div>
                  <div className="text-sm md:text-base font-bold text-blue-100 mt-1.5 tabular-nums">
                    {formatUSD(results.reduce((s, r) => s + r.amountUsd, 0))}
                  </div>
                  <div className="text-[10px] text-blue-200 mt-2 uppercase tracking-widest font-bold">
                    * 원화 반올림 및 환율 차이로 인해 미세한 오차가 발생할 수 있습니다.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Helper Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl shadow-lg p-6 text-white overflow-hidden relative" id="ai-assistant-card">
            <Sparkles className="absolute -right-4 -top-4 w-24 h-24 opacity-10 rotate-12" />
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <Sparkles size={18} className="text-yellow-300" />
              AI 배분 추천
            </h3>
            <p className="text-blue-100 text-sm mb-4">어떤 목적으로 돈을 나누시나요? AI가 최적의 비율을 추천해 드립니다.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={purposeInput}
                onChange={(e) => setPurposeInput(e.target.value)}
                placeholder="예: 월급 재테크, 결혼 준비 예산..."
                className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm placeholder:text-blue-200 focus:outline-none focus:ring-2 focus:ring-white/30 text-white"
                id="ai-purpose-input"
              />
              <button 
                type="button"
                onClick={handleAiAsk}
                disabled={isLoadingAi}
                className="bg-white text-blue-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center gap-1"
                id="ai-submit-btn"
              >
                {isLoadingAi ? <RefreshCw className="animate-spin" size={16} /> : "추천"}
              </button>
            </div>

            {aiAdvice && (
              <div className="mt-4 p-3 bg-white/10 rounded-xl border border-white/10" id="ai-advice-display">
                <h4 className="font-bold text-sm mb-1">{aiAdvice.title}</h4>
                <p className="text-xs text-blue-100 mb-3">{aiAdvice.description}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {aiAdvice.ratios.map((r, i) => (
                    <span key={i} className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                      {aiAdvice.labels[i]}: {r}
                    </span>
                  ))}
                </div>
                <button 
                  type="button"
                  onClick={applyAiAdvice}
                  className="w-full py-2 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-400 transition-colors flex items-center justify-center gap-1 shadow-sm"
                  id="apply-ai-advice-btn"
                >
                  <ArrowRightLeft size={14} />
                  이 비율 바로 적용하기
                </button>
                <p className="text-[10px] text-blue-200 mt-2 text-center font-semibold">
                  ⚠️ 제공된 추천자료는 참고용으로 사용바랍니다.
                </p>
              </div>
            )}
          </div>

          <div className="bg-slate-800 rounded-2xl p-6 text-slate-400 text-sm mt-6" id="tips-container">
            <h4 className="text-white font-bold mb-3 flex items-center gap-2">
              <RefreshCw size={14} className="text-blue-400" />
              스마트 환율 연동 기능 활용 팁
            </h4>
            <ul className="space-y-2 list-disc pl-4 opacity-80">
              <li><strong>통화 전환 (₩/$)</strong>: 상단 1번 탭을 통해 원화 혹은 달러 기반 입력을 원클릭으로 전환하여 실시간 계산 결과를 확인할 수 있습니다.</li>
              <li><strong>수동 환율 변경</strong>: 원하는 특정 가상 환율이나 목표 환전 기준이 있다면 "수동 환율 변경" 기능을 이용하여 커스텀한 비율로 오차를 시뮬레이션할 수 있습니다.</li>
            </ul>
          </div>

          {/* App Download/Install Guide */}
          <div className="bg-white rounded-2xl p-6 text-slate-600 text-sm mt-6 border border-slate-200 shadow-sm" id="pwa-install-guide">
            <h4 className="text-slate-800 font-bold mb-4 flex items-center gap-2">
              <Download size={16} className="text-blue-600" />
              앱 다운로드 방법
            </h4>
            <div className="space-y-4">
              <div>
                <h5 className="font-bold text-slate-700 text-xs mb-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  안드로이드
                </h5>
                <ul className="text-xs text-slate-500 space-y-1 pl-3.5 list-disc">
                  <li><strong>크롬</strong>: 우측 상단 더보기 메뉴(・・・) ➔ [홈 화면에 추가] 또는 [앱 설치]</li>
                  <li><strong>삼성 인터넷</strong>: 하단 메뉴(☰) ➔ [현재 페이지 추가] ➔ [홈 화면]</li>
                </ul>
              </div>
              <div>
                <h5 className="font-bold text-slate-700 text-xs mb-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  아이폰 (iOS)
                </h5>
                <ul className="text-xs text-slate-500 space-y-1 pl-3.5 list-disc">
                  <li>하단 메뉴(공유 아이콘 또는 ・・・) ➔ [홈 화면에 추가]</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="max-w-5xl mx-auto mt-16 mb-12 text-center text-slate-400 text-xs md:text-sm clear-both block w-full" id="main-footer-section">
        <p className="pt-8 border-t border-slate-200/50">© 2026 Smart Dual-Currency Splitter Tool. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;

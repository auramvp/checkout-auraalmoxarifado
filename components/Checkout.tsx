
import React, { useState, useEffect } from 'react';
import { CreditCard, QrCode, FileText, Lock, ShieldCheck, Check, ArrowRight, ArrowLeft, Zap, ChevronUp, User, Building2, AlertCircle } from 'lucide-react';
import Input from './UI/Input';
import { CheckoutFormData, PaymentMethod, Product, PersonType, PaymentResult, Coupon } from '../types';
import { processCheckout, CheckoutResult, validateCoupon } from '../services/checkoutService';
import { Tag, Ticket } from 'lucide-react';

const PLANS_DATA = {
  starter: {
    name: 'Starter',
    prices: { MONTHLY: 99.90, YEARLY: 890.00 },
    description: 'Essencial para pequenos negócios começando agora.',
    features: [
      "Capacidade: Até 01 Usuário | Até 100 Produtos",
      "Controle de Entrada e Saída",
      "Relatórios Básicos",
      "Suporte via Email"
    ]
  },
  pro: {
    name: 'Pro',
    prices: { MONTHLY: 297.00, YEARLY: 2600.00 },
    description: 'Ideal para empresas em crescimento com mais volume.',
    features: [
      "Capacidade: Até 02 Usuários | Até 300 Produtos",
      "Controle de Validade e Lotes",
      "Alertas de Estoque Baixo",
      "Tudo do Plano Starter"
    ]
  },
  business: {
    name: 'Business',
    prices: { MONTHLY: 497.00, YEARLY: 4400.00 },
    description: 'Ideal para empresas que dividem o estoque por departamentos.',
    features: [
      "Capacidade: Até 03 Usuários | Até 500 Produtos",
      "Controle por Setores (Centros de Custo)",
      "Relatórios Gerenciais para decisão",
      "Tudo do Plano Pro"
    ]
  },
  intelligence: {
    name: 'Intelligence',
    prices: { MONTHLY: 997.00, YEARLY: 8900.00 },
    description: 'Gestão preditiva com IA para máxima eficiência.',
    features: [
      "Usuários Ilimitados",
      "Previsão de Compra com IA",
      "Dashboard em Tempo Real",
      "Tudo do Plano Business"
    ]
  }
};

type PlanKey = keyof typeof PLANS_DATA;

interface CheckoutProps {
  onComplete: (data: CheckoutFormData, result: PaymentResult) => void;
  initialPlan?: PlanKey;
  initialCycle?: 'MONTHLY' | 'YEARLY';
}

const Checkout: React.FC<CheckoutProps> = ({ onComplete, initialPlan = 'business', initialCycle = 'MONTHLY' }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<CheckoutFormData>({
    fullName: '',
    email: '',
    phone: '',
    personType: 'individual',
    document: '',
    postalCode: '',
    address: '',
    number: '',
    city: '',
    state: '',
    paymentMethod: 'credit_card',
    cardNumber: '',
    cardExpiry: '',
    cardCVC: '',
    cardName: '',
  });

  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .slice(0, 14);
  };

  const formatCNPJ = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{1})(\d{4})(\d)/, '$1 $2-$3')
        .slice(0, 16);
    }
    return value.slice(0, 16);
  };

  const formatCEP = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 9);
  };

  const formatCardNumber = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{4})(\d)/g, '$1 $2')
      .slice(0, 19);
  };

  const formatCardExpiry = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .slice(0, 5);
  };

  const formatCardCVC = (value: string) => {
    return value.replace(/\D/g, '').slice(0, 4);
  };

  const fetchAddress = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            address: data.logradouro || prev.address,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }));
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      } finally {
        setCepLoading(false);
      }
    }
  };

  const fetchCNPJData = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length === 14) {
      setCnpjLoading(true);
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
        if (response.ok) {
          const data = await response.json();
          setFormData(prev => ({
            ...prev,
            fullName: data.razao_social || prev.fullName,
            postalCode: data.cep ? formatCEP(data.cep) : prev.postalCode,
            address: data.logradouro || prev.address,
            number: data.numero || prev.number,
            city: data.municipio || prev.city,
            state: data.uf || prev.state,
          }));
        }
      } catch (error) {
        console.error("Erro ao buscar CNPJ:", error);
      } finally {
        setCnpjLoading(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    let formattedValue = value;
    if (name === 'document') {
      formattedValue = formData.personType === 'individual' ? formatCPF(value) : formatCNPJ(value);
      if (formData.personType === 'legal' && formattedValue.replace(/\D/g, '').length === 14) {
        fetchCNPJData(formattedValue);
      }
    } else if (name === 'phone') {
      formattedValue = formatPhone(value);
    } else if (name === 'postalCode') {
      formattedValue = formatCEP(value);
      if (formattedValue.replace(/\D/g, '').length === 8) {
        fetchAddress(formattedValue);
      }
    } else if (name === 'cardNumber') {
      formattedValue = formatCardNumber(value);
    } else if (name === 'cardExpiry') {
      formattedValue = formatCardExpiry(value);
    } else if (name === 'cardCVC') {
      formattedValue = formatCardCVC(value);
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handlePersonTypeChange = (type: PersonType) => {
    setFormData(prev => ({ ...prev, personType: type, document: '', fullName: '' }));
  };

  const handlePaymentMethod = (method: PaymentMethod) => {
    setFormData(prev => ({ ...prev, paymentMethod: method }));
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 3));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(initialPlan);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>(initialCycle);

  const currentPlan = PLANS_DATA[selectedPlan];
  const basePrice = currentPlan.prices[billingCycle];

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === 'percentage') {
      return (basePrice * appliedCoupon.value) / 100;
    }
    return appliedCoupon.value;
  };

  const discountAmount = calculateDiscount();
  const currentPrice = Math.max(0, basePrice - discountAmount);

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const result = await validateCoupon(couponCode);
      if (result.success && result.coupon) {
        setAppliedCoupon(result.coupon);
        setFormData(prev => ({ ...prev, couponCode: result.coupon?.code }));
      } else {
        setCouponError(result.error || 'Erro ao validar cupom');
        setAppliedCoupon(null);
      }
    } catch (error) {
      setCouponError('Erro inesperado ao validar cupom');
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setFormData(prev => ({ ...prev, couponCode: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 3) {
      nextStep();
      return;
    }
    setLoading(true);
    setCheckoutError(null);

    try {
      const result = await processCheckout(formData, selectedPlan, billingCycle);

      if (result.success) {
        const paymentResult: PaymentResult = {
          success: true,
          paymentMethod: formData.paymentMethod,
          pixQrCode: result.pixQrCode,
          pixCopyPaste: result.pixCopyPaste,
          boletoUrl: result.boletoUrl,
          boletoBarcode: result.boletoBarcode,
        };
        onComplete(formData, paymentResult);
      } else {
        setCheckoutError(result.error || 'Erro ao processar checkout');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = () => {
    if (currentStep === 1) {
      const docValid = formData.personType === 'individual' ? formData.document.length === 14 : formData.document.length === 18;
      return formData.fullName && formData.email && docValid && formData.phone.length >= 14;
    }
    if (currentStep === 2) {
      return formData.postalCode.length === 9 && formData.address && formData.number && formData.city && formData.state;
    }
    if (currentStep === 3 && formData.paymentMethod === 'credit_card') {
      return formData.cardNumber && formData.cardNumber.length >= 16 && formData.cardExpiry && formData.cardExpiry.length === 5 && formData.cardCVC && formData.cardCVC.length >= 3 && formData.cardName;
    }
    return true;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 flex flex-col w-full">
      <header className="mb-4 w-full shrink-0 flex flex-col items-center text-center">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-4 w-full">
          <div className="shrink-0 animate-in fade-in zoom-in duration-700">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30 ring-1 ring-white/10">
              <ChevronUp size={20} className="text-white" strokeWidth={3} />
            </div>
          </div>

          <div className="h-[1px] w-8 bg-slate-800/50 hidden md:block" />

          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[9px] transition-all duration-500 ${currentStep === step
                    ? 'aura-bg-blue text-white shadow-xl shadow-blue-500/40 scale-105'
                    : currentStep > step
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'
                    }`}>
                    {currentStep > step ? <Check size={12} /> : step}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-[0.1em] hidden sm:block ${currentStep === step ? 'text-white' : 'text-slate-600'}`}>
                    {step === 1 ? 'Identificação' : step === 2 ? 'Endereço' : 'Pagamento'}
                  </span>
                </div>
                {step < 3 && <div className="h-[1px] w-6 sm:w-10 bg-slate-800/50 mx-0.5 rounded-full" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <h1 className="text-2xl font-black tracking-tight text-white mb-1">
          {currentStep === 1 && <>Dados <span className="text-blue-500">Pessoais</span></>}
          {currentStep === 2 && <>Seu <span className="text-blue-500">Endereço</span></>}
          {currentStep === 3 && <>Forma de <span className="text-blue-500">Pagamento</span></>}
        </h1>
        <p className="text-slate-400 text-[11px] font-medium max-w-xl opacity-80">
          {currentStep === 1 && "Informações para faturamento seguro."}
          {currentStep === 2 && "Localização do seu almoxarifado."}
          {currentStep === 3 && "Escolha o melhor método de investimento."}
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-5 items-stretch">
        <div className="w-full lg:flex-1 flex flex-col">
          <form id="checkout-form" onSubmit={handleSubmit} className="flex-1 bg-[#111827]/90 rounded-[2rem] border border-slate-800/50 p-5 md:p-6 shadow-3xl backdrop-blur-xl flex flex-col justify-between relative overflow-hidden ring-1 ring-white/5">
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              {/* TRIAL PILL - Only shows for card and pix_auto */}
              {(formData.paymentMethod === 'credit_card' || formData.paymentMethod === 'pix_auto') && (
                <div className="mb-5">
                  <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 px-5 py-3 rounded-xl shadow-sm">
                    <div className="bg-blue-500 rounded-lg p-1.5 shrink-0 shadow-lg shadow-blue-500/20">
                      <Zap size={14} className="text-white fill-white" />
                    </div>
                    <p className="text-[10px] md:text-[11px] font-bold text-slate-300 leading-relaxed">
                      <span className="text-blue-400 font-black uppercase tracking-[0.1em] mr-1 block sm:inline">Teste Grátis:</span>
                      A primeira cobrança será feita apenas após <span className="text-white font-black">07 dias</span>. Cancele quando quiser sem nenhum custo adicional nesse período.
                    </p>
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-5">
                  {/* Person Type Selector */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">TIPO DE PESSOA</label>
                    <div className="flex gap-3 p-1 bg-slate-900/60 border border-slate-800 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handlePersonTypeChange('individual')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all font-black text-[9px] tracking-widest uppercase ${formData.personType === 'individual' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        <User size={14} />
                        Pessoa Física
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePersonTypeChange('legal')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all font-black text-[9px] tracking-widest uppercase ${formData.personType === 'legal' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        <Building2 size={14} />
                        Pessoa Jurídica
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formData.personType === 'individual' ? (
                      <>
                        <Input label="NOME COMPLETO" name="fullName" required value={formData.fullName} onChange={handleChange} placeholder="Digite seu nome" />
                        <Input label="E-MAIL" name="email" type="email" required value={formData.email} onChange={handleChange} placeholder="seu@email.com" />
                        <Input label="CPF" name="document" required value={formData.document} onChange={handleChange} placeholder="000.000.000-00" />
                        <Input label="CELULAR" name="phone" required value={formData.phone} onChange={handleChange} placeholder="(00) 0 0000-0000" />
                      </>
                    ) : (
                      <>
                        <div className="relative">
                          <Input label="CNPJ" name="document" required value={formData.document} onChange={handleChange} placeholder="00.000.000/0000-00" />
                          {cnpjLoading && (
                            <div className="absolute right-3 bottom-3 animate-spin w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full"></div>
                          )}
                        </div>
                        <Input label="RAZÃO SOCIAL" name="fullName" required value={formData.fullName} onChange={handleChange} placeholder="Nome da sua empresa" />
                        <Input label="E-MAIL" name="email" type="email" required value={formData.email} onChange={handleChange} placeholder="seu@email.com" />
                        <Input label="CELULAR" name="phone" required value={formData.phone} onChange={handleChange} placeholder="(00) 0 0000-0000" />
                      </>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
                  <div className="relative">
                    <Input label="CEP" name="postalCode" required value={formData.postalCode} onChange={handleChange} placeholder="00000-000" />
                    {cepLoading && (
                      <div className="absolute right-3 bottom-3 animate-spin w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full"></div>
                    )}
                  </div>
                  <Input label="LOGRADOURO" name="address" required className="md:col-span-2" value={formData.address} onChange={handleChange} placeholder="Rua, Avenida..." />
                  <Input label="Nº" name="number" required value={formData.number} onChange={handleChange} placeholder="123" />
                  <Input label="CIDADE" name="city" required value={formData.city} onChange={handleChange} placeholder="Ex: Vitória" />
                  <Input label="ESTADO" name="state" required value={formData.state} onChange={handleChange} placeholder="UF" />
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  {/* Trial Notice */}
                  <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-xl">
                    <p className="text-[10px] text-amber-400 font-bold leading-relaxed">
                      <span className="font-black">⚡ Teste grátis de 7 dias:</span> Disponível apenas para pagamento com <span className="text-white">Cartão de Crédito</span> ou <span className="text-white">PIX Automático</span>.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => handlePaymentMethod('credit_card')}
                      className={`py-3 px-2 rounded-xl border transition-all flex flex-col items-center gap-2 ${formData.paymentMethod === 'credit_card' ? 'border-blue-500 bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20' : 'border-slate-800 bg-slate-900/40 text-slate-500 hover:border-slate-700'}`}
                    >
                      <CreditCard size={18} />
                      <span className="text-[8px] font-black uppercase tracking-widest">Cartão</span>
                      <span className="text-[7px] text-emerald-500 font-bold">7 dias grátis</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePaymentMethod('pix_auto')}
                      className={`py-3 px-2 rounded-xl border transition-all flex flex-col items-center gap-2 ${formData.paymentMethod === 'pix_auto' ? 'border-blue-500 bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20' : 'border-slate-800 bg-slate-900/40 text-slate-500 hover:border-slate-700'}`}
                    >
                      <QrCode size={18} />
                      <span className="text-[8px] font-black uppercase tracking-widest">PIX Auto</span>
                      <span className="text-[7px] text-emerald-500 font-bold">7 dias grátis</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePaymentMethod('pix')}
                      className={`py-3 px-2 rounded-xl border transition-all flex flex-col items-center gap-2 ${formData.paymentMethod === 'pix' ? 'border-blue-500 bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20' : 'border-slate-800 bg-slate-900/40 text-slate-500 hover:border-slate-700'}`}
                    >
                      <QrCode size={18} />
                      <span className="text-[8px] font-black uppercase tracking-widest">PIX Único</span>
                      <span className="text-[7px] text-slate-500 font-bold">Pagar agora</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePaymentMethod('boleto')}
                      className={`py-3 px-2 rounded-xl border transition-all flex flex-col items-center gap-2 ${formData.paymentMethod === 'boleto' ? 'border-blue-500 bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20' : 'border-slate-800 bg-slate-900/40 text-slate-500 hover:border-slate-700'}`}
                    >
                      <FileText size={18} />
                      <span className="text-[8px] font-black uppercase tracking-widest">Boleto</span>
                      <span className="text-[7px] text-slate-500 font-bold">Pagar agora</span>
                    </button>
                  </div>

                  {formData.paymentMethod === 'credit_card' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Input label="NÚMERO DO CARTÃO" name="cardNumber" required className="md:col-span-2" value={formData.cardNumber} onChange={handleChange} placeholder="0000 0000 0000 0000" />
                      <Input label="TITULAR" name="cardName" required value={formData.cardName} onChange={handleChange} placeholder="NOME NO CARTÃO" />
                      <div className="grid grid-cols-2 gap-3">
                        <Input label="VALIDADE" name="cardExpiry" required value={formData.cardExpiry} onChange={handleChange} placeholder="MM/AA" />
                        <Input label="CVC" name="cardCVC" required value={formData.cardCVC} onChange={handleChange} placeholder="123" />
                      </div>
                    </div>
                  )}

                  {formData.paymentMethod === 'pix_auto' && (
                    <div className="bg-emerald-600/5 border border-emerald-500/10 p-4 rounded-xl text-center animate-in fade-in slide-in-from-top-2 duration-300">
                      <Zap size={20} className="text-emerald-500 mx-auto mb-1" />
                      <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">PIX Automático</p>
                      <p className="text-slate-400 text-[9px]">Débito automático via PIX. Teste grátis por 7 dias.</p>
                    </div>
                  )}

                  {formData.paymentMethod === 'pix' && (
                    <div className="bg-blue-600/5 border border-blue-500/10 p-4 rounded-xl text-center animate-in fade-in slide-in-from-top-2 duration-300">
                      <QrCode size={20} className="text-blue-500 mx-auto mb-1" />
                      <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">PIX Único</p>
                      <p className="text-slate-400 text-[9px]">Pague agora via QR Code. Acesso liberado após confirmação.</p>
                    </div>
                  )}

                  {formData.paymentMethod === 'boleto' && (
                    <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl text-center animate-in fade-in slide-in-from-top-2 duration-300">
                      <FileText size={20} className="text-slate-500 mx-auto mb-1" />
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Boleto Bancário</p>
                      <p className="text-slate-500 text-[9px]">Vencimento em 3 dias úteis. Acesso liberado após compensação.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-5">
              {/* Error Message */}
              {checkoutError && (
                <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl">
                  <AlertCircle size={16} className="text-red-500 shrink-0" />
                  <p className="text-[11px] text-red-400 font-bold">{checkoutError}</p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 mb-4 pt-4 border-t border-slate-800/60">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-white font-black text-[9px] tracking-widest transition-all"
                  >
                    <ArrowLeft size={14} />
                    VOLTAR
                  </button>
                ) : <div />}

                <button
                  type="submit"
                  disabled={!isStepValid() || loading}
                  className="px-8 py-3 aura-button-gradient text-white font-black rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed group shadow-xl"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="text-[9px] uppercase tracking-[0.1em]">{currentStep === 3 ? "FINALIZAR" : "PRÓXIMO"}</span>
                      {currentStep < 3 ? <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /> : <Lock size={16} />}
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/10">
                <div className="flex items-center gap-4 opacity-80">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" className="h-3 w-auto object-contain" alt="Visa" />
                  <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-4 w-auto object-contain" alt="Mastercard" />
                  <img src="https://logodownload.org/wp-content/uploads/2020/02/pix-bc-logo-3.png" className="h-4 w-auto object-contain" alt="Pix" />
                  <svg viewBox="0 0 24 24" className="h-4 w-auto" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="5" width="18" height="14" rx="1" className="stroke-slate-400" />
                    <line x1="6" y1="9" x2="6" y2="15" className="stroke-slate-400" />
                    <line x1="9" y1="9" x2="9" y2="15" className="stroke-slate-400" />
                    <line x1="12" y1="9" x2="12" y2="15" className="stroke-slate-400" />
                    <line x1="15" y1="9" x2="15" y2="15" className="stroke-slate-400" />
                    <line x1="18" y1="9" x2="18" y2="15" className="stroke-slate-400" />
                  </svg>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                  <ShieldCheck size={12} className="text-blue-500" />
                  Transação Segura
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="w-full lg:w-[340px] flex flex-col pt-4 lg:pt-0">
          <div className="flex-1 bg-[#111827] border-2 border-blue-600 rounded-[2rem] p-5 shadow-3xl relative overflow-hidden flex flex-col justify-between ring-1 ring-blue-500/10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[8px] font-black px-4 py-1 rounded-b-lg uppercase tracking-[0.1em] shadow-lg z-10">
              PLANO SELECIONADO
            </div>

            <div className="relative">
              <div className="mt-4 mb-4 pb-4 border-b border-slate-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-black text-white tracking-tight">{currentPlan.name}</h3>
                  <span className="bg-blue-600/10 text-blue-500 text-[7px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest border border-blue-500/10">
                    {selectedPlan.slice(0, 3).toUpperCase()}
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-black text-slate-500">R$</span>
                  <span className="text-4xl font-black text-white tracking-tighter">
                    {currentPrice.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                    {billingCycle === 'MONTHLY' ? '/mês' : '/ano'}
                  </span>
                </div>
              </div>

              <ul className="space-y-2 mb-4">
                {currentPlan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <div className="mt-0.5 bg-blue-600/20 rounded p-0.5 shrink-0">
                      <Check size={10} className="text-blue-500" strokeWidth={3} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800/60 shadow-inner">
                <div className="flex justify-between text-[10px] mb-2">
                  <span className="text-slate-500 font-black uppercase tracking-[0.05em]">Subtotal</span>
                  <span className="text-white font-black text-sm">R$ {basePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between text-[10px] mb-2 text-emerald-500">
                    <span className="font-black uppercase tracking-[0.05em]">Desconto ({appliedCoupon.code})</span>
                    <span className="font-black">- R$ {discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div className="mb-4 pt-2">
                  {!appliedCoupon ? (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="CUPOM"
                          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 pl-9 pr-2 text-[10px] font-bold text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponCode}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[9px] font-black px-3 py-2 rounded-lg transition-all tracking-widest"
                      >
                        {couponLoading ? "..." : "APLICAR"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Ticket size={14} className="text-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{appliedCoupon.code}</span>
                      </div>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="text-[9px] font-black text-slate-500 hover:text-red-500 transition-all uppercase tracking-widest"
                      >
                        Remover
                      </button>
                    </div>
                  )}
                  {couponError && (
                    <p className="text-[9px] text-red-500 mt-1 font-bold">{couponError}</p>
                  )}
                </div>

                <div className="flex justify-between text-[10px] pt-2 border-t border-slate-800/30">
                  <span className="text-slate-500 font-black uppercase tracking-[0.05em]">Total Final</span>
                  <span className="text-blue-500 font-black text-lg">R$ {currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-[10px] pt-2 border-t border-slate-800/30">
                  <span className="text-slate-500 font-black uppercase tracking-[0.05em]">Ativação</span>
                  <span className="text-emerald-500 font-black tracking-[0.1em]">GRÁTIS</span>
                </div>
              </div>

              <div className="flex flex-col items-center">
                <p className="text-[8px] text-slate-600 font-black flex items-center gap-1.5 uppercase tracking-[0.1em]">
                  <Lock size={10} className="text-blue-500 opacity-60" />
                  SSL 256-BIT ENCRYPTION
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;


import React, { useEffect, useState } from 'react';
import { CheckCircle, Copy, ExternalLink, Mail, Zap, FileText, ArrowRight } from 'lucide-react';
import { CheckoutFormData, PaymentResult } from '../types';

interface ThankYouProps {
  orderData: Partial<CheckoutFormData>;
  paymentResult: PaymentResult | null;
}

const ThankYou: React.FC<ThankYouProps> = ({ orderData, paymentResult }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    console.log('PaymentResult:', paymentResult);
  }, [paymentResult]);

  const handleCopy = () => {
    if (paymentResult?.pixCopyPaste) {
      navigator.clipboard.writeText(paymentResult.pixCopyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isPix = orderData.paymentMethod === 'pix';
  const isBoleto = orderData.paymentMethod === 'boleto';
  const isCard = orderData.paymentMethod === 'credit_card';

  // Build registration URL with email, CNPJ and fullName
  const cleanDocument = orderData.document?.replace(/\D/g, '') || '';
  const baseUrl = 'https://app.auraalmoxarifado.com.br/#/?flow=onboarding';
  const params = new URLSearchParams();
  if (orderData.email) params.append('email', orderData.email);
  if (orderData.fullName) params.append('name', orderData.fullName);
  if (cleanDocument.length > 11) params.append('cnpj', cleanDocument);
  const registerUrl = `${baseUrl}&${params.toString()}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col min-h-screen">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600/10 text-blue-500 rounded-2xl mb-3 border border-blue-500/20">
          <CheckCircle size={32} strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl md:text-3xl font-black mb-1 tracking-tighter text-white">
          Pedido <span className="text-blue-500">Confirmado!</span>
        </h1>
        <p className="text-slate-400 text-sm">
          Parabéns, <span className="text-white font-black">{orderData.fullName?.split(' ')[0]}</span>! Sua jornada com a Aura começou.
        </p>
      </div>

      {/* Cards Grid - Compact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Summary Card - Compact */}
        <div className="bg-[#111827]/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black flex items-center gap-2 text-white uppercase">
              <Mail size={14} className="text-blue-500" />
              Resumo
            </h3>
            <span className="text-[8px] font-black text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">TRANS #AUR-98412</span>
          </div>

          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-500 font-bold text-[10px] uppercase">Plano</span>
            <span className="text-white font-black text-sm">Business</span>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center">
            <span className="text-slate-500 font-bold text-[10px] uppercase">Total</span>
            <span className="text-xl font-black text-blue-500">R$ 497,00<span className="text-[9px] text-slate-600 font-bold">/mês</span></span>
          </div>
        </div>

        {/* Payment Status Card - Compact */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Zap size={50} className="text-blue-500" />
          </div>

          {isPix && paymentResult?.pixQrCode ? (
            <div className="flex flex-col items-center relative z-10">
              <h3 className="text-sm font-black text-white mb-1 uppercase">Pague com PIX</h3>
              <p className="text-slate-400 text-[9px] font-bold mb-2">Escaneie ou copie o código</p>

              <div className="bg-white p-2 rounded-lg mb-2">
                <img
                  src={`data:image/png;base64,${paymentResult.pixQrCode}`}
                  alt="QR Code PIX"
                  className="w-24 h-24"
                />
              </div>

              <button
                onClick={handleCopy}
                className={`w-full py-2 rounded-lg font-black text-[9px] tracking-widest flex items-center justify-center gap-2 transition-all ${copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
              >
                {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
                {copied ? 'COPIADO!' : 'COPIAR CÓDIGO'}
              </button>
            </div>
          ) : isBoleto && paymentResult?.boletoUrl ? (
            <div className="flex flex-col items-center relative z-10">
              <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center mb-2">
                <FileText size={20} className="text-white" />
              </div>
              <h3 className="text-sm font-black text-white mb-1 uppercase">Boleto Gerado</h3>
              <a
                href={paymentResult.boletoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 rounded-lg font-black text-[9px] tracking-widest flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white transition-all"
              >
                <ExternalLink size={12} />
                VISUALIZAR BOLETO
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center relative z-10">
              <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center mb-2">
                <CheckCircle size={20} className="text-white" />
              </div>
              <h3 className="text-sm font-black text-emerald-500 mb-1">Pagamento Aprovado!</h3>
              <p className="text-slate-400 text-[10px] text-center">
                Recebemos seu pagamento com sucesso.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Call to Action - Only show for trial methods (card, pix_auto) */}
      {(isCard || orderData.paymentMethod === 'pix_auto') && (
        <div className="bg-gradient-to-b from-blue-600/5 to-transparent border border-blue-500/20 rounded-2xl p-6 text-center">
          <div className="mb-4">
            <h2 className="text-lg font-black text-white mb-2">Próximo Passo: Crie sua Conta</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Clique no botão abaixo para criar sua conta no Aura Almoxarifado.
              <span className="text-blue-400 font-bold"> Será utilizado o mesmo e-mail da compra
                {cleanDocument.length > 11 && ' e o CNPJ informado'}</span> para facilitar seu cadastro.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <a
              href={registerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 aura-button-gradient text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all hover:scale-105 shadow-lg shadow-blue-500/25"
            >
              <span>CRIAR MINHA CONTA</span>
              <ArrowRight size={18} />
            </a>

            <div className="text-[10px] text-slate-500 flex flex-col items-center gap-1">
              <p>📧 {orderData.email}</p>
              {cleanDocument.length > 11 && <p>🏢 {orderData.document}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Message for PIX/Boleto - awaiting payment */}
      {(isPix || isBoleto) && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 text-center">
          <p className="text-amber-400 text-sm font-bold mb-2">⏳ Aguardando Pagamento</p>
          <p className="text-slate-400 text-xs max-w-xl mx-auto">
            Após a confirmação do pagamento, você receberá um e-mail com o link para criar sua conta no Aura Almoxarifado.
          </p>
        </div>
      )}
    </div>
  );
};

export default ThankYou;

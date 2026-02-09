
import React, { useState } from 'react';
import Checkout from './components/Checkout';
import ThankYou from './components/ThankYou';
import { CheckoutFormData, PaymentResult } from './types';

const App: React.FC = () => {
  const [isFinished, setIsFinished] = useState(false);
  const [orderData, setOrderData] = useState<Partial<CheckoutFormData>>({});
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  const handleComplete = (data: CheckoutFormData, result: PaymentResult) => {
    setOrderData(data);
    setPaymentResult(result);
    setIsFinished(true);
    window.scrollTo(0, 0);
  };

  const queryParams = new URLSearchParams(window.location.search);
  const initialPlan = queryParams.get('plan') || 'business';
  const initialCycle = (queryParams.get('cycle')?.toUpperCase() === 'YEARLY') ? 'YEARLY' : 'MONTHLY';

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0b0f19]">
      <main className="flex-1 flex flex-col pt-2 md:pt-4 pb-2 overflow-y-auto">
        {!isFinished ? (
          <Checkout
            onComplete={handleComplete}
            initialPlan={initialPlan as any}
            initialCycle={initialCycle as any}
          />
        ) : (
          <ThankYou orderData={orderData} paymentResult={paymentResult} />
        )}
      </main>

      <footer className="w-full py-3 px-6 shrink-0 bg-[#0b0f19]">
        <div className="max-w-md mx-auto flex flex-col items-center text-center">
          {/* Custom Horizontal Line */}
          <div className="w-full h-[1px] bg-slate-800/60 mb-3 rounded-full"></div>

          <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/90">
              Aura Almoxarifado Inteligente
            </p>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
              © {new Date().getFullYear()} Todos os direitos reservados
            </p>
            <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest opacity-80">
              CNPJ: 48.18.200/0001-95
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

import { CheckoutFormData, Coupon } from '../types';
import { supabase } from '../supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export interface CheckoutResult {
    success: boolean;
    subscriptionId?: string;
    companyId?: string;
    asaasSubscriptionId?: string;
    pixQrCode?: string;
    pixCopyPaste?: string;
    boletoUrl?: string;
    boletoBarcode?: string;
    error?: string;
}

export async function validateCoupon(code: string): Promise<{ success: boolean; coupon?: Coupon; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .eq('code', code)
            .eq('is_active', true)
            .single();

        if (error) {
            return { success: false, error: 'Cupom inválido ou não encontrado' };
        }

        const now = new Date();
        const startDate = new Date(data.start_date);
        const endDate = new Date(data.end_date);

        if (now < startDate || now > endDate) {
            return { success: false, error: 'Cupom expirado ou ainda não disponível' };
        }

        if (data.max_uses && data.current_uses >= data.max_uses) {
            return { success: false, error: 'Cupom atingiu o limite máximo de usos' };
        }

        return { success: true, coupon: data as Coupon };
    } catch (error) {
        console.error('Error validating coupon:', error);
        return { success: false, error: 'Erro ao validar cupom' };
    }
}

export async function processCheckout(
    formData: CheckoutFormData,
    planKey: 'starter' | 'pro' | 'business' | 'intelligence' = 'business',
    billingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY'
): Promise<CheckoutResult> {
    // Validate environment variables first
    if (!SUPABASE_URL || SUPABASE_URL === 'undefined') {
        return {
            success: false,
            error: 'Configuração ausente: VITE_SUPABASE_URL não localizada. Verifique as Variáveis de Ambiente no Vercel (deve começar com VITE_) e refaça o Deploy.',
        };
    }

    try {
        const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/create-subscription`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...formData,
                planKey,
                billingCycle,
                couponCode: formData.couponCode,
            }),
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const errorText = await response.text();
            console.error('Non-JSON response received:', errorText);
            return {
                success: false,
                error: `Erro do servidor: O endpoint não retornou JSON. Verifique se a URL do Supabase está correta.`,
            };
        }

        const result = await response.json();

        if (!response.ok || !result.success) {
            return {
                success: false,
                error: result.error || 'Erro ao processar pagamento',
            };
        }

        return {
            success: true,
            subscriptionId: result.subscriptionId,
            companyId: result.companyId,
            asaasSubscriptionId: result.asaasSubscriptionId,
            pixQrCode: result.pixQrCode,
            pixCopyPaste: result.pixCopyPaste,
            boletoUrl: result.boletoUrl,
            boletoBarcode: result.boletoBarcode,
        };
    } catch (error) {
        console.error('Checkout error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
        };
    }
}

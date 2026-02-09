import { CheckoutFormData } from '../types';

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

export async function processCheckout(
    formData: CheckoutFormData,
    planKey: 'starter' | 'pro' | 'business' | 'intelligence' = 'business',
    billingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY'
): Promise<CheckoutResult> {
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/create-subscription`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...formData,
                planKey,
                billingCycle,
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

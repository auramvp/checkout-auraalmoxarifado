import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!;
const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL') || 'https://api.asaas.com/v3';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TURNSTILE_SECRET_KEY = '0x4AAAAAACaSmmqvYLnMafsHl2UjuqMa7N'; // Provided by user

interface CheckoutData {
    fullName: string;
    email: string;
    phone: string;
    document: string;
    personType: 'individual' | 'legal';
    postalCode: string;
    address: string;
    number: string;
    city: string;
    state: string;
    paymentMethod: 'credit_card' | 'pix' | 'pix_auto' | 'boleto';
    planKey: 'starter' | 'pro' | 'business' | 'intelligence';
    billingCycle: 'MONTHLY' | 'YEARLY';
    cardNumber?: string;
    cardExpiry?: string;
    cardCVC?: string;
    cardName?: string;
    turnstileToken?: string;
    couponCode?: string;
}

const PLAN_VALUES = {
    starter: { MONTHLY: 99.90, YEARLY: 890.00 },
    pro: { MONTHLY: 297.00, YEARLY: 2600.00 },
    business: { MONTHLY: 497.00, YEARLY: 4400.00 },
    intelligence: { MONTHLY: 997.00, YEARLY: 8900.00 },
};

const PLAN_IDS = {
    starter: '4f65fc87-2c9c-46cd-9ea3-6fa1d7d12889',
    pro: '3c6ad4b5-6e31-48b8-ad92-715cec145eae',
    business: 'd9552f1d-122e-4e68-bd60-c16592167c80',
    intelligence: 'a1d17fda-74e3-4e96-a5ff-de8843f37546',
};

async function verifyTurnstile(token: string, ip: string) {
    if (!token) return { success: false, errorCodes: ['missing-input-response'] };

    const formData = new URLSearchParams();
    formData.append('secret', TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        body: formData,
        method: 'POST',
    });

    const outcome = await result.json();
    console.log('Turnstile verification:', outcome);
    return {
        success: outcome.success,
        errorCodes: outcome['error-codes'] || []
    };
}

async function asaasRequest(endpoint: string, method: string, body?: object) {
    console.log(`Asaas request: ${method} ${endpoint}`);
    const response = await fetch(`${ASAAS_BASE_URL}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    console.log(`Asaas response:`, JSON.stringify(result));
    return result;
}

async function createOrGetCustomer(data: CheckoutData) {
    const cleanDocument = data.document.replace(/\D/g, '');

    const existing = await asaasRequest(`/customers?cpfCnpj=${cleanDocument}`, 'GET');
    if (existing.data && existing.data.length > 0) {
        return existing.data[0];
    }

    const customer = await asaasRequest('/customers', 'POST', {
        name: data.fullName,
        email: data.email,
        phone: data.phone.replace(/\D/g, ''),
        cpfCnpj: cleanDocument,
        postalCode: data.postalCode.replace(/\D/g, ''),
        address: data.address,
        addressNumber: data.number,
        province: data.city,
        externalReference: cleanDocument,
    });

    return customer;
}

async function createSubscription(customerId: string, data: CheckoutData) {
    const planValue = PLAN_VALUES[data.planKey][data.billingCycle];

    const nextDueDate = new Date();
    // Trial for card/pix_auto
    if (data.paymentMethod === 'credit_card' || data.paymentMethod === 'pix_auto') {
        nextDueDate.setDate(nextDueDate.getDate() + 7);
    } else {
        // Immediate for pix/boleto
        nextDueDate.setDate(nextDueDate.getDate() + (data.paymentMethod === 'boleto' ? 3 : 0));
    }
    const formattedDate = nextDueDate.toISOString().split('T')[0];

    const billingType = data.paymentMethod === 'credit_card' ? 'CREDIT_CARD'
        : (data.paymentMethod === 'pix' || data.paymentMethod === 'pix_auto') ? 'PIX'
            : 'BOLETO';

    const subscriptionData: any = {
        customer: customerId,
        billingType,
        value: planValue,
        nextDueDate: formattedDate,
        cycle: data.billingCycle,
        description: `Aura Almoxarifado - Plano ${data.planKey.charAt(0).toUpperCase() + data.planKey.slice(1)}`,
        externalReference: data.document.replace(/\D/g, ''),
    };

    if (data.paymentMethod === 'credit_card' && data.cardNumber) {
        const [expMonth, expYear] = (data.cardExpiry || '').split('/');
        subscriptionData.creditCard = {
            holderName: data.cardName,
            number: data.cardNumber.replace(/\s/g, ''),
            expiryMonth: expMonth,
            expiryYear: `20${expYear}`,
            ccv: data.cardCVC,
        };
        subscriptionData.creditCardHolderInfo = {
            name: data.cardName,
            email: data.email,
            cpfCnpj: data.document.replace(/\D/g, ''),
            postalCode: data.postalCode.replace(/\D/g, ''),
            addressNumber: data.number,
            phone: data.phone.replace(/\D/g, ''),
        };
    }

    return await asaasRequest('/subscriptions', 'POST', subscriptionData);
}

async function saveToSupabase(data: CheckoutData) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const cleanDocument = data.document.replace(/\D/g, '');
    const planName = `Plano ${data.planKey.charAt(0).toUpperCase() + data.planKey.slice(1)}`;
    const planValue = PLAN_VALUES[data.planKey][data.billingCycle];

    const nextBillingDate = new Date();
    if (data.paymentMethod === 'credit_card' || data.paymentMethod === 'pix_auto') {
        nextBillingDate.setDate(nextBillingDate.getDate() + 7);
    } else {
        nextBillingDate.setDate(nextBillingDate.getDate() + (data.paymentMethod === 'boleto' ? 3 : 0));
    }

    const isTrial = data.paymentMethod === 'credit_card' || data.paymentMethod === 'pix_auto';

    const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
            company: data.fullName,
            cnpj: cleanDocument,
            plan: planName,
            value: planValue,
            status: isTrial ? 'trial' : 'pending_payment',
            next_billing: nextBillingDate.toISOString().split('T')[0],
            payment_method: data.paymentMethod,
            email: data.email,
            billing_cycle: data.billingCycle,
        })
        .select('id')
        .single();

    if (subError) console.error('Subscription error:', subError);

    const { data: company, error: compError } = await supabase
        .from('companies')
        .insert({
            cnpj: cleanDocument,
            name: data.fullName,
            email: data.email,
            phone: data.phone.replace(/\D/g, ''),
            address: `${data.address}, ${data.number} - ${data.city}/${data.state} - CEP: ${data.postalCode}`,
            status: isTrial ? 'Pending' : 'AwaitingPayment',
            plan: planName,
            plan_id: PLAN_IDS[data.planKey],
        })
        .select('id')
        .single();

    if (compError) console.error('Company error:', compError);

    return { subscriptionId: subscription?.id, companyId: company?.id };
}

async function sendCheckoutEmail(emailData: object) {
    try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-checkout-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailData), \n
        }); \n
    } catch (error) { \n    console.error('Email error:', error); \n } \n
} \n\nDeno.serve(async (req: Request) => { \n  if (req.method === 'OPTIONS') { \n    return new Response(null, { \n      headers: { \n        'Access-Control-Allow-Origin': '*', \n        'Access-Control-Allow-Methods': 'POST, OPTIONS', \n        'Access-Control-Allow-Headers': 'Content-Type, Authorization', \n }, \n }); \n } \n  \n  try { \n    const data: CheckoutData = await req.json(); \n    \n    // Turnstile Verification\n    const clientIp = req.headers.get('x-forwarded-for') || '';\n    const verification = await verifyTurnstile(data.turnstileToken || '', clientIp);\n    \n    if (!verification.success) {\n      console.warn('Turnstile verification failed for:', data.email, verification.errorCodes);\n       return new Response(JSON.stringify({ \n         success: false, \n         error: `Verificação de segurança falhou: ${verification.errorCodes.join(', ')}. Por favor, recarregue a página.` \n       }), {\n        status: 400,\n        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },\n      });\n    }\n\n    const planName = `Plano ${data.planKey.charAt(0).toUpperCase() + data.planKey.slice(1)}`;\n    const planValue = PLAN_VALUES[data.planKey][data.billingCycle];\n    \n    // 1. Create or get customer\n    const customer = await createOrGetCustomer(data);\n    if (customer.errors) {\n      return new Response(JSON.stringify({ success: false, error: customer.errors[0].description }), {\n        status: 400,\n        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },\n      });\n    }\n    \n    // 2. Create actual Subscription\n    const subscription = await createSubscription(customer.id, data);\n    if (subscription.errors) {\n      return new Response(JSON.stringify({ success: false, error: subscription.errors[0].description }), {\n        status: 400,\n        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },\n      });\n    }\n    \n    // 3. Save to Supabase\n    const { subscriptionId, companyId } = await saveToSupabase(data);\n    \n    // 4. Return success\n    const response: any = {\n      success: true,\n      subscriptionId,\n      companyId,\n      asaasSubscriptionId: subscription.id,\n      asaasCustomerId: customer.id,\n    };\n    \n    const isTrial = data.paymentMethod === 'credit_card' || data.paymentMethod === 'pix_auto';\n    \n    // Get invoice info for first charge (if not trial) or to show QR Code\n    if (data.paymentMethod === 'pix' || data.paymentMethod === 'pix_auto' || data.paymentMethod === 'boleto') {\n      // Find the first installment/invoice of the subscription\n      const payments = await asaasRequest(`/subscriptions/${subscription.id}/payments`, 'GET');\n      if (payments.data && payments.data.length > 0) {\n        const firstPayment = payments.data[0];\n        \n        if (data.paymentMethod === 'pix' || data.paymentMethod === 'pix_auto') {\n          const pixInfo = await asaasRequest(`/payments/${firstPayment.id}/pixQrCode`, 'GET');\n          response.pixQrCode = pixInfo.encodedImage;\n          response.pixCopyPaste = pixInfo.payload;\n          \n          await sendCheckoutEmail({\n            to: data.email,\n            type: data.paymentMethod === 'pix_auto' ? 'pix_auto_created' : 'pix_created',\n            customerName: data.fullName,\n            planName,\n            planValue,\n            document: data.document.replace(/\D/g, ''),\n            pixQrCode: pixInfo.encodedImage,\n            pixCopyPaste: pixInfo.payload,\n            isTrial,\n          });\n        } else if (data.paymentMethod === 'boleto') {\n          response.boletoUrl = firstPayment.bankSlipUrl;\n          response.boletoBarcode = firstPayment.nossoNumero;\n          \n          await sendCheckoutEmail({\n            to: data.email,\n            type: 'boleto_created',\n            customerName: data.fullName,\n            planName,\n            planValue,\n            document: data.document.replace(/\D/g, ''),\n            boletoUrl: firstPayment.bankSlipUrl,\n          });\n        }\n      }\n    }\n    \n    if (data.paymentMethod === 'credit_card') {\n      await sendCheckoutEmail({\n        to: data.email,\n        type: 'trial_started',\n        customerName: data.fullName,\n        planName,\n        planValue,\n        document: data.document.replace(/\D/g, ''),\n      });\n    }\n    \n    return new Response(JSON.stringify(response), {\n      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },\n    });\n    \n  } catch (error) {\n    console.error('Checkout error:', error);\n    return new Response(JSON.stringify({ success: false, error: error.message }), {\n      status: 500,\n      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },\n    });\n  }\n});\n

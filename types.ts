
export type PaymentMethod = 'credit_card' | 'pix' | 'pix_auto' | 'boleto';
export type PersonType = 'individual' | 'legal';
export type BillingCycle = 'MONTHLY' | 'YEARLY';

export interface CheckoutFormData {
  fullName: string;
  email: string;
  phone: string;
  personType: PersonType;
  document: string; // CPF or CNPJ
  postalCode: string;
  address: string;
  number: string;
  city: string;
  state: string;
  paymentMethod: PaymentMethod;
  cardNumber?: string;
  cardExpiry?: string;
  cardCVC?: string;
  cardName?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
}

export interface PaymentResult {
  success: boolean;
  paymentMethod: PaymentMethod;
  pixQrCode?: string;
  pixCopyPaste?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
  error?: string;
}

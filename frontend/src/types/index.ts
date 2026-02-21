/* ───── Auth ───── */
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'operator';
  permissions: string[];
  active: number;
  created_at: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

/* ───── Clients ───── */
export interface Client {
  id: number;
  name: string;
  document: string;
  phone: string;
  email: string;
  address: string;
  observations: string;
  child_name?: string;
  birth_date?: string;
  active: number;
  created_at: string;
  updated_at: string;
}

/* ───── Items ───── */
export type RentalPeriod = 'hour' | 'day' | 'week' | 'month';
export type ItemStatus = 'available' | 'rented' | 'maintenance';

export interface Item {
  id: number;
  name: string;
  internal_code: string;
  category: string;
  rental_value: number;
  rental_period: RentalPeriod;
  status: ItemStatus;
  observations: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface ItemPricing {
  id: number;
  item_id: number;
  duration_minutes: number;
  label: string;
  price: number;
  sort_order: number;
  tolerance_minutes: number;
}

/* ───── Rentals ───── */
export type RentalStatus = 'active' | 'completed' | 'cancelled' | 'overdue';

export interface Rental {
  id: number;
  client_id: number;
  item_id: number;
  start_date: string;
  expected_end_date: string;
  actual_end_date: string | null;
  rental_value: number;
  deposit: number;
  late_fee: number;
  discount: number;
  total_value: number;
  total_paid: number;
  status: RentalStatus;
  observations: string;
  pricing_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
  client_name: string;
  child_name?: string | null;
  item_name: string;
  item_code: string;
}

/* ───── Payments ───── */
export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'pix' | 'transfer' | 'other';

export interface Payment {
  id: number;
  rental_id: number;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  notes: string;
  created_at: string;
  client_name: string;
  item_name: string;
}

export interface PaymentBalance {
  total_value: number;
  total_paid: number;
  remaining: number;
}

/* ───── Cashier ───── */
export type CashRegisterStatus = 'open' | 'closed';

export interface CashRegister {
  id: number;
  user_id: number;
  opening_balance: number;
  closing_balance: number | null;
  total_entries: number;
  total_exits: number;
  status: CashRegisterStatus;
  observations: string;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

export interface CashTransaction {
  id: number;
  cash_register_id: number;
  type: 'entry' | 'exit';
  category: string;
  amount: number;
  description: string;
  payment_method: string;
  reference_type: string;
  reference_id: number;
  user_id: number;
  cancelled: number;
  cancelled_at: string | null;
  cancelled_by: number | null;
  cancellation_reason: string | null;
  created_at: string;
  user_name?: string;
}

export interface CashSummary {
  register: CashRegister;
  current_balance: number;
  totals: { entries: number; exits: number };
  by_category: { category: string; type: string; total: number; count: number }[];
  by_payment_method: { payment_method: string; total: number; count: number }[];
}

/* ───── Reports / Dashboard ───── */
export interface Dashboard {
  total_clients: number;
  total_items: number;
  items_available: number;
  items_rented: number;
  items_maintenance: number;
  active_rentals: number;
  overdue_rentals: number;
  revenue_today: number;
  revenue_month: number;
  revenue_total: number;
}

export interface TopItem {
  item_id: number;
  item_name: string;
  internal_code: string;
  rental_count: number;
  total_revenue: number;
}

export interface TopClient {
  client_id: number;
  client_name: string;
  rental_count: number;
  total_spent: number;
}

export interface RevenueByPeriod {
  period: string;
  total: number;
  count: number;
}

export interface PaymentMethodStat {
  method: string;
  total: number;
  count: number;
}

/* ───── Paginated ───── */
export interface Paginated<T> {
  data: T[];
  total: number;
}

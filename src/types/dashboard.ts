export type { CandidateBreakdown, MatchBreakdown } from "@/lib/smartMatcher";

export interface AccountBreakdown {
  account: string;
  total: number;
}

export interface DashboardSummary {
  totalDeposits: number;
  totalWithdrawals: number;
  latestBalance: number;
  deposit: number;
  manualIn: number;
  bonus: number;
  fixedDeposit: number;
  withdraw: number;
  manualOut: number;
  redeem: number;
  affiliate: number;
  cashback: number;
  depositBreakdown: AccountBreakdown[];
  withdrawalBreakdown: AccountBreakdown[];
}

export interface TransactionRecord {
  id: string;
  project_id: string;
  project_name?: string;
  source_project_id: string;
  target_project_id: string;
  amount: number;
  ai_amount: number;
  is_duplicate: boolean;
  sender_name: string;
  receiver_name: string;
  sender_bank?: string;
  receiver_bank?: string;
  sender_account?: string;
  transfer_at: string;
  image_path?: string;
  created_at: string;
  project_account_id?: string;
  matching_status?:
    | "AUTO_MAPPED"
    | "PENDING_REVIEW"
    | "MANUAL_MAPPED"
    | "UNMAPPED";
  matching_confidence?: number;
  possible_matches?: string[]; // UUIDs
  match_breakdown?: import("@/lib/smartMatcher").MatchBreakdown;
  ref_id?: string;
}

export interface ProjectAccount {
  id: string;
  project_id: string;
  account_name: string;
  account_number: string;
  bank_code: string;
  aliases?: string;
  created_at: string;
}

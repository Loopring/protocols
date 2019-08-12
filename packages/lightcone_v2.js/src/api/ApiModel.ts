export interface DexConfiguration {
  dex_id: string;
  dex_address: string;
  account_creation_fee_eth: string;
  account_update_fee_eth: string;
  deposit_fee_eth: string;
  onchain_withdrawal_fee_eth: string;
  offchain_withdrawal_fee_token_id: any;
  offchain_withdrawal_fee_amount: string;
  order_cancellation_fee_eth: string;
  in_maintainance: string;
}
